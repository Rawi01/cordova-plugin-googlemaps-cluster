/// <reference types="rbush" />
import { LatLngBounds, Marker, LatLng, GoogleMap, CameraPosition } from "@ionic-native/google-maps";
import BBox = rbush.BBox;
import "rxjs/add/operator/debounceTime";
import "rxjs/add/operator/take";
export interface Point {
    x: number;
    y: number;
}
export declare class MarkerObject implements BBox {
    marker: any;
    constructor(marker: any);
    basePoint: Point;
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
    addedToMap: boolean;
    addedToCluster: boolean;
}
export declare class Cluster {
    constructor();
    private bounds;
    private marker;
    private centerPoint;
    addedToMap: boolean;
    addedToCluster: boolean;
    getBounds(): LatLngBounds;
    getCenter(): LatLng;
    getMarker(): MarkerObject[];
    getCenterPoint(): Point;
    addMarker(marker: MarkerObject): void;
}
export interface MarkerClusterOptions {
    mergeDistance?: any;
    mergeDistanceModifier?: any;
    maxZoom?: any;
    spiderfyZoom?: any;
    maxClusterZoom?: any;
    itemToMarker?: any;
    clusterIcon?: any;
}
export declare class MarkerCluster {
    map: GoogleMap;
    private options;
    private markerObjectList;
    private currentZoom;
    private cluster;
    private cachedCluster;
    private rbush;
    private updating;
    private queuedUpdate;
    private markerList;
    private spiderfiedMarkers;
    private spiderfiedCluster;
    private spiderfiedClusterClicked;
    constructor(map: GoogleMap, options: MarkerClusterOptions);
    bufferCameraChange(camera: CameraPosition): void;
    handleCameraChange(camera: CameraPosition): void;
    spiderfy(marker: Marker, cluster: Cluster): void;
    unspiderfy(): void;
    private getCirclePoints(center, count);
    clearMap(): void;
    addMarkerForRegion(region: any): void;
    updateCluster(zoom: number): boolean;
    addMarker(marker: any): void;
    refresh(): void;
    clusterAtScale(scale: any): Cluster[];
    private clusterAtScale2(scale, markerList);
    zoomToWithPadding(positions: LatLng[]): void;
}
