import {
  LatLngBounds, Marker, LatLng, GoogleMap, GoogleMapsEvent, CameraPosition,
  ILatLng
} from "@ionic-native/google-maps";
import * as rbush from "rbush"
import BBox = rbush.BBox;
import RBush = rbush.RBush;
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/take";

export interface Point {
  x: number;
  y: number;
}


function toPoint(position: ILatLng) {
  let sin = Math.sin(position.lat * Math.PI / 180);
  let y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
  return {
    x: position.lng / 360 + 0.5,
    y: y < 0 ? 0 : y > 1 ? 1 : y
  }
}

function toLatLng(point: Point): LatLng {
  var y2 = (180 - point.y * 360) * Math.PI / 180;
  return new LatLng(360 * Math.atan(Math.exp(y2)) / Math.PI - 90, (point.x - 0.5) * 360);
}

export class MarkerObject implements BBox {
  constructor(public marker) {
    this.basePoint = toPoint(marker.position);
  }

  basePoint: Point;
  get minX(): number {
    return this.basePoint.x;
  }
  get minY(): number {
    return this.basePoint.y;
  }
  get maxX(): number {
    return this.basePoint.x;
  }
  get maxY(): number {
    return this.basePoint.y;
  }
  addedToMap = false;
  addedToCluster = false;
}

export class Cluster {
  constructor() {
    this.bounds = new LatLngBounds([]);
  }

  private bounds: LatLngBounds;
  private marker = [];
  private centerPoint: Point;
  addedToMap = false;
  addedToCluster = false;

  getBounds() {
    return this.bounds;
  }

  getCenter() {
    return this.bounds.getCenter();
  }

  getMarker(): MarkerObject[] {
    return this.marker;
  }

  getCenterPoint(): Point {
    return this.centerPoint;
  }

  addMarker(marker: MarkerObject) {
    this.bounds.extend(marker.marker.position);
    this.centerPoint = toPoint(this.getCenter());
    this.marker.push(marker);
  }

}

export interface MarkerClusterOptions {
  mergeDistance?;
  mergeDistanceModifier?;
  maxZoom?;
  spiderfyZoom?;
  maxClusterZoom?;
  itemToMarker?;
  clusterIcon?;
}

export class MarkerCluster {
  private options: MarkerClusterOptions;
  private markerObjectList: MarkerObject[] = [];
  private currentZoom = 0;
  private cluster: Cluster[];
  private cachedCluster = new Map<number, Cluster[]>();
  private rbush = <RBush<MarkerObject>>rbush();
  private updating = false;
  private queuedUpdate;
  private markerList: Marker[] = [];
  private spiderfiedMarkers: Marker[] = [];
  private spiderfiedCluster;
  private spiderfiedClusterClicked = false;

  constructor(public map: GoogleMap, options: MarkerClusterOptions) {
    this.options = Object.assign({
      mergeDistance: 0.2,
      mergeDistanceModifier: 0,
      maxZoom: 20,
      spiderfyZoom: 18,
      maxClusterZoom: 99,
      itemToMarker: (item) => {},
      clusterIcon: (cluster: Cluster) => {}
    }, options);

    map.on(GoogleMapsEvent.CAMERA_MOVE_END).debounceTime(100).subscribe(cam => this.bufferCameraChange(cam));
    map.on(GoogleMapsEvent.MAP_CLICK).subscribe(() => this.unspiderfy());
    map.on(GoogleMapsEvent.MAP_READY).take(1).subscribe(() => this.redraw());
  }

  bufferCameraChange(camera: CameraPosition<any>) {
    if(this.updating) {
      this.queuedUpdate = () => this.handleCameraChange(camera);
    } else {
      this.handleCameraChange(camera);
    }
  }

  handleCameraChange(camera: CameraPosition<any>) {
    //Remove previous spider
    if(this.spiderfiedClusterClicked) {
      this.spiderfiedClusterClicked = false;
    } else {
      this.unspiderfy();
    }

    if(this.updateCluster(camera.zoom || camera[0].zoom)) {
      this.clearMap();
    }
    let region = this.map.getVisibleRegion();

    let botLeft = toPoint(region.southwest);
    let topRight = toPoint(region.northeast);

    let addedMarker = this.cluster.filter(cluster => {
      return !cluster.addedToMap
        && cluster.getCenterPoint().x >= botLeft.x && cluster.getCenterPoint().x <= topRight.x
        && cluster.getCenterPoint().y <= botLeft.y && cluster.getCenterPoint().y >= topRight.y
    }).map(cluster => {
      let marker = cluster.getMarker();
      cluster.addedToMap = true;
      if(marker.length == 1) {
        let markerConfig = marker[0].marker;
        return this.map.addMarker(markerConfig).then((mapMarker: Marker) => {
          if(markerConfig.markerClick) {
            mapMarker.on(GoogleMapsEvent.MARKER_CLICK).subscribe(() => {
              markerConfig.markerClick(mapMarker);
            })
          }
          if(markerConfig.infoClick) {
            mapMarker.on(GoogleMapsEvent.INFO_CLICK).subscribe(() => {
              markerConfig.infoClick(mapMarker);
            })
          }
          return mapMarker;
        });
      } else {
        return this.map.addMarker({
          position: cluster.getCenter(),
          icon: this.options.clusterIcon(cluster)
        }).then((marker: Marker) => {
          marker.on(GoogleMapsEvent.MARKER_CLICK).subscribe(() => {
            let latLng = cluster.getMarker().map(m => m.marker.position);

            if(this.currentZoom < this.options.spiderfyZoom) {
              this.zoomToWithPadding(latLng);
              //this.map.moveCamera({target: latLng})
            } else {
              this.spiderfy(marker, cluster);
            }
          });
          return marker;
        })
      }
    });
    Promise.all(addedMarker).then(marker => {
      this.markerList.push(...marker);

      if(this.queuedUpdate != null) {
        let update = this.queuedUpdate;
        this.queuedUpdate = null;
        update();
      } else {
        this.updating = false;
      }
    })
  }

  spiderfy(marker: Marker, cluster: Cluster) {
    this.spiderfiedClusterClicked = true;
    if(this.spiderfiedCluster == marker) {
      return;
    }
    //Remove previous spider
    this.unspiderfy();

    let points = this.getCirclePoints(cluster.getCenterPoint(), cluster.getMarker().length);
    Promise.all(cluster.getMarker().map((m, i) => {
      let newMarker = Object.assign({}, m.marker);
      newMarker.position = toLatLng(points[i]);
      newMarker.disableAutoPan = true;
      return this.map.addMarker(newMarker);
    })).then(spiderfiedMarkers => this.spiderfiedMarkers = spiderfiedMarkers);
    marker.setOpacity(0.5);
    this.spiderfiedCluster = marker;
  }

  unspiderfy() {
    if(this.spiderfiedMarkers.length > 0) {
      this.spiderfiedMarkers.forEach(sm => {
        sm.remove();
      });
      this.spiderfiedMarkers = [];
      this.spiderfiedCluster.setOpacity(1);
      this.spiderfiedCluster = null;
    }
  }

  private getCirclePoints(center: Point, count) {
    let camera = this.map.getCameraPosition();
    let distance = 0.25 / Math.pow(2, camera.zoom);
    let points: Point[] = [];
    let angle = 0;
    let step = Math.PI*2/count;
    for(let i = 0; i < count; i++) {
      points.push({
        x: center.x + distance * Math.cos(angle),
        y: center.y + distance * Math.sin(angle)
      });
      angle += step;
    }
    return points;
  }

  private clearMap() {
    this.markerList.forEach(marker => marker.remove());
    this.markerList = [];
    this.cluster.forEach(cluster => {
      cluster.addedToMap = false;
    });
  }

  addMarkerForRegion(region) {

  }

  updateCluster(zoom: number): boolean {
    let newZoom = Math.min(Math.ceil(zoom), this.options.maxClusterZoom);
    if(newZoom == this.currentZoom) {
      return false;
    }
    this.currentZoom = newZoom;
    this.cluster = this.clusterAtScale(this.currentZoom);
    return true;
  }

  addMarker(marker) {
    this.markerObjectList.push(...marker.map(m => new MarkerObject(m)));
    this.rbush.load(this.markerObjectList);
  }

  reset() {
    this.markerObjectList = [];
    this.queuedUpdate = null;
    this.cachedCluster.clear();
    this.cluster = [];
    this.rbush.clear();
    this.clearMap();
    this.currentZoom = 0;
  }

  redraw() {
    this.cachedCluster.clear();
    this.currentZoom = 0;
    let camera = this.map.getCameraPosition();
    this.bufferCameraChange(camera);
  }

  clusterAtScale(scale): Cluster[] {
    if(this.cachedCluster.has(scale)) {
      return this.cachedCluster.get(scale);
    }
    let cluster = this.clusterAtScale2(scale, this.markerObjectList);
    this.cachedCluster.set(scale, cluster);
    return cluster;
  }


  private clusterAtScale2(scale: number, markerList: MarkerObject[]): Cluster[] {
    let mergeDistance = (this.options.mergeDistance + (this.options.mergeDistanceModifier * scale)) / (1 << scale);

    if(scale >= this.options.maxClusterZoom) {
      return markerList.map(marker => {
        let newCluster = new Cluster();
        newCluster.addMarker(marker);
        return newCluster;
      })
    }

    let cluster = [];
    markerList.forEach(obj => {
      if(!obj.addedToCluster) {
        let markerToAdd = this.rbush.search({
          minX: obj.minX - mergeDistance,
          minY: obj.minY - mergeDistance,
          maxX: obj.maxX + mergeDistance,
          maxY: obj.maxY + mergeDistance,
        });
        let newCluster = new Cluster();
        markerToAdd.filter(m => !m.addedToCluster).forEach(m => {
          m.addedToCluster = true;
          newCluster.addMarker(m);
        });
        cluster.push(newCluster);
      }
    });
    markerList.forEach(obj => {
      obj.addedToCluster = false;
    });
    return cluster;
  }

  zoomToWithPadding(positions: LatLng[]) {
    let bounds = new LatLngBounds(positions);
    let northeast = toPoint(bounds.northeast);
    let southwest = toPoint(bounds.southwest);
    let distX = Math.abs(southwest.x - northeast.x);
    let distY = Math.abs(southwest.y - northeast.y);
    let mapDiv = this.map.get("div");
    let newZoom = Math.max(Math.log2(distX), Math.log2(distY) * (mapDiv.clientHeight / mapDiv.clientWidth)) * -1 - 0.05;
    newZoom = Math.min(this.options.maxZoom, newZoom);
    let newCenter = toPoint(bounds.getCenter());
    newCenter.y -= 0.1 / Math.pow(2, newZoom);
    this.map.animateCamera({
      target: toLatLng(newCenter),
      zoom: newZoom,
      duration: 300
    })
  }
}
