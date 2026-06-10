sap.ui.define([
    'jquery.sap.global',
    "sap/m/library",
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/pod2/context/PodContext",
    "sap/dm/dme/pod2/context/ModelPath",
    "sap/dm/dme/pod2/api/RestClient",
    "sap/dm/dme/pod2/api/ApiPaths",
    "sap/dm/dme/pod2/widget/core/TableWidget",
    "mhp/pod2/zplugins/asbuiltreportplugin/controller/utils/Commons",
    "mhp/pod2/zplugins/asbuiltreportplugin/model/formatter",
], function (
    jQuery,
    MobileLibrary,
    Controller,
    JSONModel,
    PodContext,
    ModelPath,
    RestClient,
    ApiPaths,
    TableWidget,
    Commons,
    formatter
) {
    "use strict";

    const { MessageBox, MessageToast } = MobileLibrary;

    return Controller.extend("mhp.pod2.zplugins.asbuiltreportplugin.controller.MainView", {
        Commons: Commons,
        formatter: formatter,

        onInit: function () {
        },

        onAfterRendering: function () {
            console.log("After Rendering")
        },

        onExit: function () {
            // PluginViewController.prototype.onExit.apply(this, arguments);
        },

        _getFilters: async function () {
            const oViewModel = this.getView().getModel("viewModel"),
                oViewModelData = oViewModel.getData();

            const aWorkCenters = await Commons.getWorkCenters(oViewModelData.plant);
            debugger
        },

        onItemPress: function (oEvent) {
            const oView = this.getView(),
                oItem = oEvent.getParameter("listItem"),
                oSelectedItemData = oItem.getBindingContext("AsBuilt").getObject(),
                oFCL = this.getView().getParent().getParent();

            oView.getModel("AsBuilt").setProperty(
                "/selectedComponent",
                oSelectedItemData
            );

            oFCL.setLayout("TwoColumnsMidExpanded");
        },

    });
});
