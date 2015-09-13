define({
    map: true,
    identifyLayerInfos: true,
    proxy_url: 'http://localhost/cmv/proxy/PHP/proxy.php',

    layers2render: [
        {
            id: 'Cities',
            url: 'http://sampleserver5.arcgisonline.com/arcgis/rest/services/WorldTimeZones/MapServer/0',
            fields: ['POP_CLASS','CITY_NAME','POP_RANK' ]
        },{
            id: 'Continent',
            url: 'http://sampleserver5.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/1',
            fields: ['CONTINENT']
        }
    ]

});
