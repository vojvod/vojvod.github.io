define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dojo/dom-construct',
    'dojo/_base/lang',
    'dojo/aspect',
    'dojo/_base/array',
    'dijit/form/FilteringSelect',
    'dojo/store/Memory',
    'esri/layers/FeatureLayer',
    'esri/symbols/SimpleLineSymbol',
    'esri/symbols/SimpleFillSymbol',
    'esri/tasks/ClassBreaksDefinition',
    'esri/tasks/UniqueValueDefinition',
    'esri/tasks/AlgorithmicColorRamp',
    'esri/tasks/GenerateRendererParameters',
    'esri/tasks/GenerateRendererTask',
    'esri/Color',
    'dijit/form/Button',
    'dojo/text!./Renderer/templates/Renderer.html',
    'dojo/i18n!./Renderer/nls/resource',
    'xstyle/css!./Renderer/css/Renderer.css'


], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, domConstruct, lang, aspect, array,
             FilteringSelect, Memory, FeatureLayer,
             SimpleLineSymbol, SimpleFillSymbol, ClassBreaksDefinition, UniqueValueDefinition, AlgorithmicColorRamp, GenerateRendererParameters,
             GenerateRendererTask, Color, Button, Renderer, i18n) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        widgetsInTemplate: true,
        templateString: Renderer,
        baseClass: 'gis_RendererDijit',
        i18n: i18n,
        layerSeparator: '||',
        init_renderers: [],

        postCreate: function () {

            this.inherited(arguments);

            esri.config.defaults.io.proxyUrl = this.proxy_url;

            this.layers = [];
            array.forEach(this.layers2render, function (layerInfo) {

                var layer = new FeatureLayer(layerInfo.url, {
                    mode: FeatureLayer.MODE_ONDEMAND,
                    id: layerInfo.id,
                    outFields: ['*'],
                    opacity: 0.7
                });

                if (layer) {
                    this.layers.push({
                        ref: layerInfo.id,
                        layerInfo: layer,
                        fields: layerInfo.fields
                    });
                }

            }, this);


            this.init_renderers.push({
                layerid: 'simos',
                init_render: 'null'
            });

            this.initRendererButton.on('click', lang.hitch(this, 'initRenderer'));
            this.setRendererButton.on('click', lang.hitch(this, 'createRenderer'));

            // rebuild the layer selection list when the map is updated
            // but only if we have a UI
            if (this.parentWidget) {
                this.loadEpipedoOptions();
                this.map.on('update-end', lang.hitch(this, function () {
                    this.loadEpipedoOptions();
                }));
            }

            if (this.parentWidget) {
                if (this.parentWidget.toggleable) {
                    this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                        this.onLayoutChange(this.parentWidget.open);
                    })));
                }
                this.own(aspect.after(this.parentWidget, 'resize', lang.hitch(this, function () {
                    this.gis_RendererDijitContainerNode.resize();
                })));
            }

        },

        onLayoutChange: function (open) {
            if (open) {
                this.gis_RendererDijitContainerNode.resize();
            }
        },

        loadEpipedoOptions: function () {

            var id = null;
            var renderingItems = [];
            var selectedId = this.querySelectEpipedo.get('value');
            var sep = this.layerSeparator;

            var i = 0;
            array.forEach(this.layers, lang.hitch(this, function (layer) {
                renderingItems.push({
                    name: layer.ref,
                    id: layer.ref + sep + i,
                    layer: layer.layerInfo,
                    fields: layer.fields
                });
                i++;
            }));

            renderingItems.sort(function (a, b) {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            });

            this.querySelectEpipedo.set('disabled', (renderingItems.length < 1));
            if (renderingItems.length > 0) {
                renderingItems.unshift({
                    name: this.i18n.selectQueryLayer,
                    id: '***'
                });
                if (!id) {
                    id = renderingItems[0].id;
                }
            }
            var layer4rendering = new Memory({
                data: renderingItems
            });

            this.querySelectEpipedo.set('store', layer4rendering);
            this.querySelectEpipedo.set('value', id);
        },

        _onQuerySelectEpipedoChange: function () {
            var t = this;
            var id = null;
            var renderedFields = [];
            var comboItem = t.querySelectEpipedo.item;

            if (this.querySelectEpipedo.item.layer) {
                array.forEach(this.querySelectEpipedo.item.layer.fields, function (field) {
                    array.forEach(comboItem.fields, function (name) {
                        if (name == field.name) {
                            renderedFields.push({
                                name: field.alias,
                                id: field.name,
                                type: field.type
                            });
                        }
                    });


                });
            }

            this.querySelectField.set('disabled', (renderedFields.length < 1));

            var fields4rendering = new Memory({
                data: renderedFields
            });

            this.querySelectField.set('store', fields4rendering);
            this.querySelectField.set('value', id);

            this.querySelectMethod.set('disabled', true);
            this.querySelectNumberOfClasses.set('disabled', true);
            this.querySelectStandardDeniationInterval.set('disabled', true);

        },

        _onQueryFieldChange: function () {
            if (this.querySelectField.item) {
                if (this.querySelectField.item.type == 'esriFieldTypeString') {
                    this.querySelectMethod.set('disabled', true);
                    this.querySelectNumberOfClasses.set('disabled', true);
                    this.querySelectStandardDeniationInterval.set('disabled', true);
                } else {
                    this.querySelectMethod.set('disabled', false);
                    this.querySelectNumberOfClasses.set('disabled', false);
                    this.querySelectStandardDeniationInterval.set('disabled', false);
                }
            }
        },

        _onQuerySelectMethod: function () {
            if (this.querySelectMethod.item.value == 'standard-deviation') {

                dojo.style(dojo.byId('contDiv1'), "display", "none");
                dojo.style(dojo.byId('contDiv2'), "display", "block");


            } else {

                dojo.style(dojo.byId('contDiv1'), "display", "block");
                dojo.style(dojo.byId('contDiv2'), "display", "none");
            }

        },

        createRenderer: function () {
            var app = this;
            var classDef;

            //app.sfs = new SimpleFillSymbol(
            //    SimpleFillSymbol.STYLE_SOLID,
            //    new SimpleLineSymbol(
            //        SimpleLineSymbol.STYLE_SOLID,
            //        new Color([0, 0, 0]),
            //        0.5
            //    ),
            //    null
            //);

            if (this.querySelectField.item.type == 'esriFieldTypeString') {
                classDef = new UniqueValueDefinition();
                classDef.attributeField = this.querySelectField.value;
                this.querySelectMethod.set('disabled', true);
                this.querySelectNumberOfClasses.set('disabled', true);
                this.querySelectStandardDeniationInterval.set('disabled', true);
            } else {
                this.querySelectMethod.set('disabled', false);
                this.querySelectNumberOfClasses.set('disabled', false);
                this.querySelectStandardDeniationInterval.set('disabled', false);
                classDef = new ClassBreaksDefinition();
                classDef.classificationField = this.querySelectField.value;
                classDef.classificationMethod = this.querySelectMethod.value;
                classDef.breakCount = this.querySelectNumberOfClasses.value;
                classDef.standardDeviationInterval = this.querySelectStandardDeniationInterval.value;
                //classDef.baseSymbol = app.sfs;
            }

            var colorRamp = new AlgorithmicColorRamp();
            colorRamp.fromColor = Color.fromHex("#998ec3");
            colorRamp.toColor = Color.fromHex("#f1a340");
            colorRamp.algorithm = "hsv"; // options are:  "cie-lab", "hsv", "lab-lch"
            classDef.colorRamp = colorRamp;

            var params = new GenerateRendererParameters();
            params.classificationDefinition = classDef;
            // limit the renderer to data being shown by the feature layer
            //params.where = app.layerDef;
            if (this.querySelectEpipedo.item.layer && this.querySelectField.item.type != 'esriFieldTypeGeometry') {
                var generateRenderer = new GenerateRendererTask(this.querySelectEpipedo.item.layer.url);
                generateRenderer.execute(params, lang.hitch(this, 'applyRenderer'), lang.hitch(this, 'errorHandler'));
            }
        },

        applyRenderer: function (renderer) {
            var t = this;
            var layerid = this.querySelectEpipedo.item.layer.id;
            var addRender = true;
            array.forEach(this.init_renderers, function (item) {
                if (layerid == item.layerid)
                    addRender = false;
            });
            if (addRender) {
                this.init_renderers.push({
                    layerid: layerid,
                    init_render: this.querySelectEpipedo.item.layer._getRenderer()
                });
            }

            this.initRenderer();

            var legend = dijit.byId('legend_widget');
            legend.layerInfos.push({
                layer: this.querySelectEpipedo.item.layer,
                title: this.i18n.legendThematicPart1 + this.querySelectEpipedo.item.layer.id + this.i18n.legendThematicPart2 + this.querySelectField.item.name
            });
            legend.layers.push({
                layer: this.querySelectEpipedo.item.layer
            });

            console.log(renderer);

            this.map.addLayer(this.querySelectEpipedo.item.layer);
            this.map.getLayer(this.querySelectEpipedo.item.layer.id).setRenderer(renderer);
            
            
            //this.map.getLayer(this.querySelectEpipedo.item.layer.id).redraw();
            //this.map.getLayer(this.querySelectEpipedo.item.layer.id).refresh();
            
            var simos = this.map;
            var simos2 = this.querySelectEpipedo.item.layer.id;
            setTimeout(function(){
                if(typeof simos.getLayer(simos2) !== 'undefined'){
                    simos.getLayer(simos2).redraw();
                    simos.getLayer(simos2).refresh();
                }

            },1000);
            
            dijit.byId('legend_widget').refresh();
        },

        errorHandler: function (err) {
            console.log('Oops, error: ', err);
        },

        initRenderer: function () {
            var t = this;
            var map = this.map;
            /*
             var layerid = this.querySelectEpipedo.item.layer.id;
             array.forEach(this.init_renderers, function (item) {
             if(layerid == item.layerid){
             map.getLayer(layerid).setRenderer(item.init_render);
             map.getLayer(layerid).redraw();
             map.getLayer(layerid).refresh();
             }
             });
             */
            //remove from map
            array.forEach(this.layers2render, function (item) {
                if (map.getLayer(item.id)) {
                    var layer2remove = map.getLayer(item.id);
                    map.removeLayer(layer2remove);
                }
            });
            //remove from legend
            var legend = dijit.byId('legend_widget');
            var i = 0;
            var legendItem2remove = [];
            array.forEach(legend.layers, function (layer1) {
                array.forEach(t.layers, function (layer2) {
                    if (layer1.id == layer2.layerInfo.id)
                        legendItem2remove.push(i);
                });
                i++;
            });
            array.forEach(legendItem2remove, function (id) {
                legend.layerInfos.splice(legend.layerInfos.indexOf(id), 1);
            });
            dijit.byId('legend_widget').refresh();
        }
    });

});
