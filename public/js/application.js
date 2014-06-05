$(function() {
	// generate unique user id
	var userId = Math.random().toString(16).substring(2,15);
	var socket = io.connect('/');
	var map;

	var info = $('#infobox');
	var doc = $(document);

	// custom marker's icon styles
	var tinyIcon = L.Icon.extend({
		options: {
			shadowUrl: '../assets/marker-shadow.png',
			iconSize: [25, 39],
			iconAnchor:   [12, 36],
			shadowSize: [41, 41],
			shadowAnchor: [12, 38],
			popupAnchor: [0, -30]
		}
	});
	var redIcon = new tinyIcon({ iconUrl: '../assets/marker-red.png' });
	var yellowIcon = new tinyIcon({ iconUrl: '../assets/marker-yellow.png' });

	var sentData = {};

	var connects = {};
	var markers = {};
	var active = false;

	socket.on('load:coords', function(data) {
		if (!(data.id in connects)) {
			setMarker(data);
		}

		connects[data.id] = data;
			connects[data.id].updated = $.now(); // shothand for (new Date).getTime()
	});

	// check whether browser supports geolocation api
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(positionSuccess, positionError, { enableHighAccuracy: true });
	} else {
		$('.map').text('Your browser is out of fashion, there\'s no geolocation!');
	}

	function positionSuccess(position) {
		var lat = position.coords.latitude;
		var lng = position.coords.longitude;
		var acr = position.coords.accuracy;

		// mark user's position
		var userMarker = L.marker([lat, lng], {
			icon: redIcon
		});
		// uncomment for static debug
		// userMarker = L.marker([51.45, 30.050], { icon: redIcon });

		// load leaflet map
		map = L.map('map').setView([35.843768,-78.6450559], 11);
		
		function setGridStyle(feature){
			switch (feature.properties.STATUS){
				case 'INCOMPLETE': return {color: '#FF0000', fillColor: '#FF4040', fillOpacity: 0.5, "weight": .2, };
				case 'COMPLETE': return {color: '#9FEE00', fillColor: '#B9F73E', fillOpacity: 0.5, "weight": .2, };
				case 'INPROGRESS': return {color: '#009999', fillColor: '#33CCCC', fillOpacity: 0.5, "weight": .2, };
			}
		}

		var buttonGroup = $('<div id="buttons" class="btn-group"></div>');
		popupContent = {
  	 		'COMPLETE' : '<button type="button" class="btn btn-success">COMPLETE</button>',
  	 		'INPROGRESS' : '<button type="button" class="btn btn-info">INPROGRESS</button>',
  	 		'INCOMPLETE' : '<button type="button" class="btn btn-danger">INCOMPLETE</button>'
  		};
  		
		var popup = '<div id="buttons" class="btn-group">'+ popupContent.COMPLETE + popupContent.INPROGRESS + popupContent.INCOMPLETE + '</div>';
  		// for (var each in popupContent){
  			
  		// 	$('#buttons', buttonGroup).append(popupContent[each]);
  		// };
  		
  		// var str = buttonGroup.prop('innerHTML');


		function gridAction(feature, layer){

			// var popup = L.popup().setContent(str);
			layer.bindPopup(popup);


		}



		var grid = L.esri.featureLayer('http://mapstest.raleighnc.gov/arcgis/rest/services/PublicUtility/ValveCrewTracking/MapServer/1',
            {
            	onEachFeature: gridAction,
            	style: setGridStyle
            }).addTo(map);

		// leaflet API key tiler
		//L.tileLayer('http://{s}.tile.cloudmade.com/BC9A493B41014CAABB98F0471D759707/997/256/{z}/{x}/{y}.png', { maxZoom: 18, detectRetina: true }).addTo(map);
		L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
    		attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    		maxZoom:18, detectRetina: true}).addTo(map);


		// set map bounds
		//map.fitWorld();
		userMarker.addTo(map);
		userMarker.bindPopup('<p>You are there! Your ID is ' + userId + '</p>').openPopup();

		var emit = $.now();
		// send coords on when user is active
		doc.on('mousemove', function() {
			active = true;

			sentData = {
				id: userId,
				active: active,
				coords: [{
					lat: lat,
					lng: lng,
					acr: acr
				}]
			};

			if ($.now() - emit > 30) {
				socket.emit('send:coords', sentData);
				emit = $.now();
			}
		});
	}

	doc.bind('mouseup mouseleave', function() {
		active = false;
	});

	// showing markers for connections
	function setMarker(data) {
		for (var i = 0; i < data.coords.length; i++) {
			var marker = L.marker([data.coords[i].lat, data.coords[i].lng], { icon: yellowIcon }).addTo(map);
			marker.bindPopup('<p>One more external user is here!</p>');
			markers[data.id] = marker;
		}
	}

	// handle geolocation api errors
	function positionError(error) {
		var errors = {
			1: 'Authorization fails', // permission denied
			2: 'Can\'t detect your location', //position unavailable
			3: 'Connection timeout' // timeout
		};
		showError('Error:' + errors[error.code]);
	}

	function showError(msg) {
		info.addClass('error').text(msg);

		doc.click(function() {
			info.removeClass('error');
		});
	}

	// delete inactive users every 15 sec
	setInterval(function() {
		for (var ident in connects){
			if ($.now() - connects[ident].updated > 15000) {
				delete connects[ident];
				map.removeLayer(markers[ident]);
			}
		}
	}, 15000);
});