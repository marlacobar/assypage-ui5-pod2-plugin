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
    "mhp/pod2/zplugins/AsBuiltReportPlugin/controller/utils/Commons",
    "mhp/pod2/zplugins/AsBuiltReportPlugin/model/formatter"
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

    return Controller.extend("mhp.pod2.zplugins.AsBuiltReportPlugin.controller.MainView", {

        /**
         * Called when the widget is initialized.
         * @override
         */
        onInit: function () {
            const oView = this.getView();
            const oResourceModel = new sap.ui.model.resource.ResourceModel({ bundleName: "mhp.pod2.zplugins.AsBuiltReportPlugin.i18n.i18n" });
            oView.setModel(oResourceModel, "i18n");

            const sPlant = PodContext.getPlant(),
                sPlantTimezone = PodContext.getPlantTimeZone(),
                sUserLanguage = PodContext.get(ModelPath.UserLanguage);

            let oViewModel = new JSONModel({
                busy: false,
                plant: sPlant,
                plantTimezone: sPlantTimezone,
                language: sUserLanguage,
            });
            oView.setModel(oViewModel, "viewModel");
            oView.setModel(new JSONModel(), "AsBuilt");
        },

        /**
         * Handles the search action for the As-Built report.
         *
         * @async
         * @function onSearch
         * @returns {Promise<void>} A promise that resolves when the search flow completes.
         */
        onSearch: async function () {
            const oView = this.getView(),
                oViewModel = oView.getModel("viewModel"),
                oViewModelData = oViewModel.getData(),
                oAsBuiltModel = oView.getModel("AsBuilt"),
                oBundle = oView.getModel("i18n").getResourceBundle();

            const sSfc = this.byId("idSfcInput").getValue(),
                sSfcFILabel = this.byId("idSfcFI").getLabel() ?? 'SFC',
                sComponentState = this.byId("idComponentStateSelect").getSelectedKey(),
                sFindComponent = this.byId("idFindComponentInput").getValue();

            if (!sSfc) {
                MessageBox.error(oBundle.getText("errMessage.mandatoryField", [sSfcFILabel]));
                return;
            }

            // Set one column layout
            const oFCL = oView.byId("fcl").setLayout("OneColumn");

            // Initialize AsBuilt Model
            oAsBuiltModel.setData({
                material: {},
                routing: {},
                bom: {},
                sfcStatus: "",
                components: [],
                progress: { percent: 0, display: "0%" }
            });

            oViewModel.setProperty("/busy", true);

            let oParams = {
                IN_PLANT: oViewModelData.plant,
                IN_SFC: sSfc,
                IN_COMPONENT_STATE: sComponentState,
                IN_COMPONENT: sFindComponent
            };

            try {
                const oBomComponents = await Commons.getSfcDetail(oParams);    
            
                // Async search for assembled components
                const oAssyParams = {
                    plant: oViewModelData.plant,
                    sfc: sSfc,
                    componentState: sComponentState
                };

                Commons.getAssembledComponents(oAssyParams, oBomComponents, oAsBuiltModel, oViewModel);

            } catch (oError) {
                oViewModel.setProperty("/busy", false);
                MessageToast.show(oError.message);
            }
        },

    });
});
