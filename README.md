# MarkerCluster plugin for Cordova GoogleMaps

![example](https://user-images.githubusercontent.com/5850477/27987614-c1c67d10-6410-11e7-9a22-242bdbc0dbc7.png)

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

```javascript
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
  //Distance between cluster center and markers, a higher value leads to less clusters
  mergeDistance: 0.2,
  //Distance modifier, change the distance on zoom change. Gets multiplied by zoom and added to merge distance.
  mergeDistanceModifier: 0,
  //Sets the maximum zoom level that should be set after tapping a cluster
  maxZoom: 20,
  //Starts spiderfy markers at this zoom level, use a big value to disable spiderfy
  spiderfyZoom: 18,
  //Stop clustering at this zoom level(show all markers), use a big value to cluster always
  maxClusterZoom: 99,
  //Function that have to return a path for the cluster image or a base64 encoded data url.
  //You can generate one based on the cluster data using an canvas to draw and call toDataURL() to get the image
  clusterIcon: (cluster) => this.getMarkerImage(cluster)
});

//Add markers to the cluster
this.markerCluster.addMarker(markers);

//To refresh the map
this.markerCluster.refresh();

```
# Todo

* Add to `npm`
* Documentation
* Check dependencies (dev/peer)
* Tests
