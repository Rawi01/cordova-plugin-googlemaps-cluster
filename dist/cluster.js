"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var google_maps_1 = require("@ionic-native/google-maps");
var rbush = require("rbush");
require("rxjs/add/operator/debounceTime");
require("rxjs/add/operator/take");
function toPoint(position) {
    var sin = Math.sin(position.lat * Math.PI / 180);
    var y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return {
        x: position.lng / 360 + 0.5,
        y: y < 0 ? 0 : y > 1 ? 1 : y
    };
}
function toLatLng(point) {
    var y2 = (180 - point.y * 360) * Math.PI / 180;
    return new google_maps_1.LatLng(360 * Math.atan(Math.exp(y2)) / Math.PI - 90, (point.x - 0.5) * 360);
}
var MarkerObject = (function () {
    function MarkerObject(marker) {
        this.marker = marker;
        this.addedToMap = false;
        this.addedToCluster = false;
        this.basePoint = toPoint(marker.position);
    }
    Object.defineProperty(MarkerObject.prototype, "minX", {
        get: function () {
            return this.basePoint.x;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(MarkerObject.prototype, "minY", {
        get: function () {
            return this.basePoint.y;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(MarkerObject.prototype, "maxX", {
        get: function () {
            return this.basePoint.x;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(MarkerObject.prototype, "maxY", {
        get: function () {
            return this.basePoint.y;
        },
        enumerable: true,
        configurable: true
    });
    return MarkerObject;
}());
exports.MarkerObject = MarkerObject;
var Cluster = (function () {
    function Cluster() {
        this.marker = [];
        this.addedToMap = false;
        this.addedToCluster = false;
        this.bounds = new google_maps_1.LatLngBounds([]);
    }
    Cluster.prototype.getBounds = function () {
        return this.bounds;
    };
    Cluster.prototype.getCenter = function () {
        return this.bounds.getCenter();
    };
    Cluster.prototype.getMarker = function () {
        return this.marker;
    };
    Cluster.prototype.getCenterPoint = function () {
        return this.centerPoint;
    };
    Cluster.prototype.addMarker = function (marker) {
        this.bounds.extend(marker.marker.position);
        this.centerPoint = toPoint(this.getCenter());
        this.marker.push(marker);
    };
    return Cluster;
}());
exports.Cluster = Cluster;
var MarkerCluster = (function () {
    function MarkerCluster(map, options) {
        var _this = this;
        this.map = map;
        this.markerObjectList = [];
        this.currentZoom = 0;
        this.cachedCluster = new Map();
        this.rbush = rbush();
        this.updating = false;
        this.markerList = [];
        this.spiderfiedMarkers = [];
        this.spiderfiedClusterClicked = false;
        this.options = Object.assign({
            mergeDistance: 0.2,
            mergeDistanceModifier: 0,
            maxZoom: 20,
            spiderfyZoom: 18,
            maxClusterZoom: 99,
            itemToMarker: function (item) { },
            clusterIcon: function (cluster) { }
        }, options);
        map.on(google_maps_1.GoogleMapsEvent.MAP_READY).take(1).subscribe(function () {
            map.on(google_maps_1.GoogleMapsEvent.CAMERA_MOVE_END).debounceTime(100).subscribe(function (cam) { return _this.bufferCameraChange(cam); });
            map.on(google_maps_1.GoogleMapsEvent.MAP_CLICK).subscribe(function () { return _this.unspiderfy(); });
            _this.redraw();
        });
    }
    MarkerCluster.prototype.bufferCameraChange = function (camera) {
        var _this = this;
        if (this.updating) {
            this.queuedUpdate = function () { return _this.handleCameraChange(camera); };
        }
        else {
            this.handleCameraChange(camera);
        }
    };
    MarkerCluster.prototype.handleCameraChange = function (camera) {
        var _this = this;
        //Remove previous spider
        if (this.spiderfiedClusterClicked) {
            this.spiderfiedClusterClicked = false;
        }
        else {
            this.unspiderfy();
        }
        if (this.updateCluster(camera.zoom || camera[0].zoom)) {
            this.clearMap();
        }
        var region = this.map.getVisibleRegion();
        var botLeft = toPoint(region.southwest);
        var topRight = toPoint(region.northeast);
        var addedMarker = this.cluster.filter(function (cluster) {
            return !cluster.addedToMap
                && cluster.getCenterPoint().x >= botLeft.x && cluster.getCenterPoint().x <= topRight.x
                && cluster.getCenterPoint().y <= botLeft.y && cluster.getCenterPoint().y >= topRight.y;
        }).map(function (cluster) {
            var marker = cluster.getMarker();
            cluster.addedToMap = true;
            if (marker.length == 1) {
                var markerConfig = marker[0].marker;
                return _this._addRealMarkerToMap(markerConfig);
            }
            else {
                return _this.map.addMarker({
                    position: cluster.getCenter(),
                    icon: _this.options.clusterIcon(cluster)
                }).then(function (marker) {
                    marker.on(google_maps_1.GoogleMapsEvent.MARKER_CLICK).subscribe(function () {
                        var latLng = cluster.getMarker().map(function (m) { return m.marker.position; });
                        if (_this.currentZoom < _this.options.spiderfyZoom) {
                            _this.zoomToWithPadding(latLng);
                            //this.map.moveCamera({target: latLng})
                        }
                        else {
                            _this.spiderfy(marker, cluster);
                        }
                    });
                    return marker;
                });
            }
        });
        Promise.all(addedMarker).then(function (marker) {
            (_a = _this.markerList).push.apply(_a, marker);
            if (_this.queuedUpdate != null) {
                var update = _this.queuedUpdate;
                _this.queuedUpdate = null;
                update();
            }
            else {
                _this.updating = false;
            }
            var _a;
        });
    };
    MarkerCluster.prototype.spiderfy = function (marker, cluster) {
        var _this = this;
        this.spiderfiedClusterClicked = true;
        if (this.spiderfiedCluster == marker) {
            return;
        }
        //Remove previous spider
        this.unspiderfy();
        var points = this.getCirclePoints(cluster.getCenterPoint(), cluster.getMarker().length);
        Promise.all(cluster.getMarker().map(function (m, i) {
            var newMarker = Object.assign({}, m.marker);
            newMarker.position = toLatLng(points[i]);
            newMarker.disableAutoPan = true;
            return _this._addRealMarkerToMap(newMarker);
        })).then(function (spiderfiedMarkers) { return _this.spiderfiedMarkers = spiderfiedMarkers; });
        marker.setOpacity(0.5);
        this.spiderfiedCluster = marker;
    };
    MarkerCluster.prototype.unspiderfy = function () {
        if (this.spiderfiedMarkers.length > 0) {
            this.spiderfiedMarkers.forEach(function (sm) {
                sm.remove();
            });
            this.spiderfiedMarkers = [];
            this.spiderfiedCluster.setOpacity(1);
            this.spiderfiedCluster = null;
        }
    };
    MarkerCluster.prototype.getCirclePoints = function (center, count) {
        var camera = this.map.getCameraPosition();
        var distance = 0.25 / Math.pow(2, camera.zoom);
        var points = [];
        var angle = 0;
        var step = Math.PI * 2 / count;
        for (var i = 0; i < count; i++) {
            points.push({
                x: center.x + distance * Math.cos(angle),
                y: center.y + distance * Math.sin(angle)
            });
            angle += step;
        }
        return points;
    };
    MarkerCluster.prototype.clearMap = function () {
        this.markerList.forEach(function (marker) { return marker.remove(); });
        this.markerList = [];
        this.cluster.forEach(function (cluster) {
            cluster.addedToMap = false;
        });
    };
    MarkerCluster.prototype.addMarkerForRegion = function (region) {
    };
    MarkerCluster.prototype.updateCluster = function (zoom) {
        var newZoom = Math.min(Math.ceil(zoom), this.options.maxClusterZoom);
        if (newZoom == this.currentZoom) {
            return false;
        }
        this.currentZoom = newZoom;
        this.cluster = this.clusterAtScale(this.currentZoom);
        return true;
    };
    MarkerCluster.prototype.addMarker = function (marker) {
        (_a = this.markerObjectList).push.apply(_a, marker.map(function (m) { return new MarkerObject(m); }));
        this.rbush.load(this.markerObjectList);
        var _a;
    };
    MarkerCluster.prototype.reset = function () {
        this.markerObjectList = [];
        this.queuedUpdate = null;
        this.cachedCluster.clear();
        this.cluster = [];
        this.rbush.clear();
        this.clearMap();
        this.currentZoom = 0;
    };
    MarkerCluster.prototype.redraw = function () {
        this.cachedCluster.clear();
        this.currentZoom = 0;
        var camera = this.map.getCameraPosition();
        this.bufferCameraChange(camera);
    };
    MarkerCluster.prototype.clusterAtScale = function (scale) {
        if (this.cachedCluster.has(scale)) {
            return this.cachedCluster.get(scale);
        }
        var cluster = this.clusterAtScale2(scale, this.markerObjectList);
        this.cachedCluster.set(scale, cluster);
        return cluster;
    };
    MarkerCluster.prototype.clusterAtScale2 = function (scale, markerList) {
        var _this = this;
        var mergeDistance = (this.options.mergeDistance + (this.options.mergeDistanceModifier * scale)) / (1 << scale);
        if (scale >= this.options.maxClusterZoom) {
            return markerList.map(function (marker) {
                var newCluster = new Cluster();
                newCluster.addMarker(marker);
                return newCluster;
            });
        }
        var cluster = [];
        markerList.forEach(function (obj) {
            if (!obj.addedToCluster) {
                var markerToAdd = _this.rbush.search({
                    minX: obj.minX - mergeDistance,
                    minY: obj.minY - mergeDistance,
                    maxX: obj.maxX + mergeDistance,
                    maxY: obj.maxY + mergeDistance,
                });
                var newCluster_1 = new Cluster();
                markerToAdd.filter(function (m) { return !m.addedToCluster; }).forEach(function (m) {
                    m.addedToCluster = true;
                    newCluster_1.addMarker(m);
                });
                cluster.push(newCluster_1);
            }
        });
        markerList.forEach(function (obj) {
            obj.addedToCluster = false;
        });
        return cluster;
    };
    MarkerCluster.prototype._addRealMarkerToMap = function (markerConfig) {
        return this.map.addMarker(markerConfig).then(function (mapMarker) {
            if (markerConfig.markerClick) {
                mapMarker.on(google_maps_1.GoogleMapsEvent.MARKER_CLICK).subscribe(function () {
                    markerConfig.markerClick(mapMarker);
                });
            }
            if (markerConfig.infoClick) {
                mapMarker.on(google_maps_1.GoogleMapsEvent.INFO_CLICK).subscribe(function () {
                    markerConfig.infoClick(mapMarker);
                });
            }
            return mapMarker;
        });
    };
    MarkerCluster.prototype.zoomToWithPadding = function (positions) {
        var bounds = new google_maps_1.LatLngBounds(positions);
        var northeast = toPoint(bounds.northeast);
        var southwest = toPoint(bounds.southwest);
        var distX = Math.abs(southwest.x - northeast.x);
        var distY = Math.abs(southwest.y - northeast.y);
        var mapDiv = this.map.get("div");
        var newZoom = Math.max(Math.log2(distX), Math.log2(distY) * (mapDiv.clientHeight / mapDiv.clientWidth)) * -1 - 0.05;
        newZoom = Math.min(this.options.maxZoom, newZoom);
        var newCenter = toPoint(bounds.getCenter());
        newCenter.y -= 0.1 / Math.pow(2, newZoom);
        this.map.animateCamera({
            target: toLatLng(newCenter),
            zoom: newZoom,
            duration: 300
        });
    };
    return MarkerCluster;
}());
exports.MarkerCluster = MarkerCluster;
