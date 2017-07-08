# MarkerCluster plugin for Cordova GoogleMaps

This plugin adds marker cluster support to [Cordova GoogleMaps](https://github.com/mapsplugin/cordova-plugin-googlemaps).

Only tested with Ionic 3, Android(iOS should work too) and Cordova GoogleMaps 1.4.

# Features

* Marker cluster
* Dynamic cluster icons
* Spiderfy support
* Fixed zoom animation

# Install

```
npm install --save git+https://github.com/Rawi01/cordova-plugin-googlemaps-cluster.git
```

# Usage

```
//Create your map
this.map = new GoogleMap(this.mapElement.nativeElement, {
  'backgroundColor': 'white',
  'controls': {
    'compass': true,
    'myLocationButton': true,
    'indoorPicker': true,
    'zoom': true
  },
  'gestures': {
    'scroll': true,
    'tilt': true,
    'rotate': true,
    'zoom': true
  },
});
//Create your marker cluster
this.markerCluster = new MarkerCluster(this.map, {
  //Distance between cluster center and markers
  mergeDistance: 0.2,
  //Distance modifier, change the distance on zoom change. Gets multiplied by zoom and added to merge distance.
  mergeDistanceModifier: 0,
  //Sets the maximum zoom for marker clicks
  maxZoom: 20,
  //Starts spiderfy at this zoom level
  spiderfyZoom: 18,
  //Stop clustering after this zoomlevel
  maxClusterZoom: 99,
  //Function that have to return an image for the cluster
  clusterIcon: (cluster) => this.getMarkerImage(cluster)
});

//Add markers
this.markerCluster.addMarker(markers);

```
# Todo

* Add to `npm`
* Check dependencies (dev/peer)
* Tests
