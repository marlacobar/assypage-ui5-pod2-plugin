sap.ui.define([
    "sap/m/library",
    "sap/ui/core/library",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/dm/dme/pod2/api/ApiClient",
    "sap/dm/dme/pod2/api/RestClient",
    "sap/dm/dme/pod2/api/ApiPaths",
    "sap/base/security/encodeURL",
    "sap/dm/dme/pod2/api/mdo/MDO",
    "sap/dm/dme/pod2/api/odata/ODataV4Client",

], function (
    MobileLibrary, 
    SapUiCoreLibrary, 
    JSONModel, 
    Controller, 
    History, 
    ApiClient, 
    RestClient, 
    ApiPaths, 
    encodeURL, 
    MDO, 
    ODataV4Client,
) {
    'use strict';

    const { Fragment, Priority } = SapUiCoreLibrary;
    const { MessageBox, MessageToast, Button } = MobileLibrary;
    const oMdoClient = ODataV4Client.getMdoClient();

    return {
        // ------------------------------------------------------------------------------
        // Production Processes
        // ------------------------------------------------------------------------------


        /**
         * Retrieves SFC data from the exposed Production Process API: P_AsBuiltDataReport_GetSfcData.
         *
         * @function getPPSfcData
         * @param {Object} oParams - Input parameters for the PP API call.
         * @param {string} oParams.IN_SITE - The site identifier where the PP is executed.
         * @param {string} oParams.IN_SFC - The Shop Floor Control (SFC) identifier to query.
         * @returns {Promise<Object>} A promise that resolves with the SFC data returned by the PP API.
         *
         * @example
         * this.Commons.getPPSfcData({ IN_SITE: "MFG01", IN_SFC: "SFC12345" });
         */
        getSfcDetail: async function (oParams) {
            const sApiPath = '/pe/api/v1/process/processDefinitions/start?key=REG_abce480f-fd10-4dde-945f-0594d273a550&async=false',
                sUrl = `${ApiPaths.API_GATEWAY_MS_PATH}${sApiPath}`;

            try {
            const response = await RestClient.post(sUrl, oParams);
            const oData = JSON.parse(response.sOutput);

            return oData;

            } catch (error) {
                throw new Error(error.body?.details[0]?.message);
            }
        },


        // ------------------------------------------------------------------------------
        // MDOs
        // ------------------------------------------------------------------------------


        /**
         * Retrieve the material description text from the MDO service.
         *
         * @async
         * @function getMaterialText
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.material - Material identifier.
         * @param {number} [oRequest.skip=0] - Number of records to skip (for pagination).
         * @param {number} [oRequest.top=1] - Maximum number of records to retrieve (default is 1).
         * @returns {Promise<string>} A promise that resolves to the material description text,
         * or an empty string if no description is found.
         */
        getMaterialText: async function (oRequest) {
            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                MATERIAL: oRequest.material
            });

            const oParameters = {
                $skip: oRequest.skip || 0,
                $top: oRequest.top || 1,
                $filter: sFilter,
                $select: "DESCRIPTION",
            };
            const [[aResponse]] = await oMdoClient.getPage(MDO.MaterialText, oParameters);
            return aResponse?.DESCRIPTION ?? '';
        },

        /**
         * Retrieves SFC assembly event records from the MDO service.
         *
         * Optionally updates or creates a JSON model in the current view
         * with the retrieved response data.
         *
         * @async
         * @function getSFCAssemblyEvents
         * @param {object} oRequest - Request parameters.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - SFC identifier.
         * @param {number} [oRequest.skip=0] - Number of records to skip.
         * @returns {Promise<object[]>} Promise resolving to an array of SFC assembly event records.
         */
        getSfcAssemblyEvents: async function (oRequest) {
            const bRemoved = oRequest.componentState === 'Removed' ? 'COMPONENT_REMOVE' : undefined;

            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                SFC: oRequest.sfc,
                EVENT_TYPE: bRemoved
            });

            const oParameters = {
                $skip: oRequest.skip || 0,
                $top: oRequest.top || 1000,
                $filter: sFilter,
                $select: `BOM_COMPONENT_MATERIAL,BOM_COMPONENT_MATERIAL_VERSION,BOM_COMPONENT_SEQUENCE,
                        QUANTITY_IN_BASE_UOM,BASE_UOM,QUANTITY_IN_REPORTED_UOM,REPORTED_UOM,
                        OPERATION_ACTIVITY,USER_ID,EVENT_TYPE,EVENT_OCCURRED_AT`,
                $orderby: "EVENT_OCCURRED_AT desc"
            };

            const [aResponse] = await oMdoClient.getPage(MDO.SFCAssemblyEvents, oParameters);

            // Normalize numeric fields
            aResponse.forEach((oItem) => {
                oItem.BOM_COMPONENT_SEQUENCE = parseInt(oItem.BOM_COMPONENT_SEQUENCE, 10);
                oItem.QUANTITY_IN_BASE_UOM = parseFloat(oItem.QUANTITY_IN_BASE_UOM);
                oItem.QUANTITY_IN_REPORTED_UOM = parseFloat(oItem.QUANTITY_IN_REPORTED_UOM);
            });

            return aResponse;
        },

        /**
         * Retrieve SFC Assembly Data Field records from the MDO service.
         *
         * @async
         * @function getSfcAssemblyDataField
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - Shop Floor Control (SFC) identifier.
         * @param {string|undefined} oRequest.sfcAssyEventId - SFC Assembly Event ID, may be undefined.
         * @param {number} [oRequest.skip=0] - Number of records to skip (for pagination).
         * @param {number} [oRequest.top=1000] - Maximum number of records to retrieve.
         * @returns {Promise<Object[]>} A promise that resolves to an array of assembly data field objects,
         * each containing COMPONENT_INVENTORY, DATA_FIELD_LABEL, DATA_FIELD_VALUE, and IS_DELETED.
         */
        getSfcAssemblyDataField: async function (oRequest) {
            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                SFC: oRequest.sfc,
                SFC_ASSEMBLY_EVENT_ID: oRequest.sfcAssyEventId
            });

            const oParameters = {
                $skip: oRequest.skip || 0,
                $top: oRequest.top || 1000,
                $filter: sFilter,
                $select: `COMPONENT_INVENTORY,DATA_FIELD_LABEL,DATA_FIELD_VALUE,IS_DELETED`,
            };

            const [aResponse] = await oMdoClient.getPage(MDO.SFCAssemblyDataField, oParameters);

            return aResponse;
        },

        /**
         * Retrieve and enrich assembled component data for a given SFC request.
         *
         * @async
         * @function getAssembledComponents
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - Shop Floor Control (SFC) identifier.
         * @param {string} [oRequest.componentState="All"] - Component state filter
         *        ("All", "Assembled", "Unassembled", "AssembledUnassembled", "Removed").
         * @param {Object} oBomComponents - BOM components structure containing a `components` array.
         * @param {Object} oBomComponents.components[].bomComponent - BOM component metadata
         *        including `component`, `version`, and `sequence`.
         * @param {sap.ui.model.json.JSONModel} oAsBuiltModel - UI5 JSON model used to store and refresh enriched data.
         * @param {sap.ui.model.json.JSONModel} oViewModel - View model used to control busy state and other UI flags.
         * @returns {Promise<void>} A promise that resolves when the assembled components have been
         * processed, enriched with material descriptions and data fields, filtered by state,
         * and updated in the provided model.
         *
         * @description
         * This function:
         * 1. Retrieves assembly events for the given SFC.
         * 2. Iterates over BOM components in batches to avoid blocking the event loop.
         * 3. Matches BOM components with actual assembly events.
         * 4. Enriches each component with material description and assembly data fields.
         * 5. Applies filtering based on the requested component state ("All", "Assembled", "Unassembled",
         *    "AssembledUnassembled", "Removed").
         * 6. Updates the provided JSON model with the resulting enriched components and progress percentage.
         * Errors are caught and displayed via a MessageToast.
         */
        getAssembledComponents: async function (oRequest, oBomComponents, oAsBuiltModel, oViewModel) {
            try {
                const aData = await this.getSfcAssemblyEvents(oRequest),
                    aComponents = oBomComponents.components,
                    iTotal = aComponents.length;
                let iLoaded = 0;

                // Batch Size to process components in smaller groups (5 at a time)
                const iBatchSize = 5;

                for (let i = 0; i < aComponents.length; i += iBatchSize) {
                    const oBatch = aComponents.slice(i, i + iBatchSize);

                    const results = await Promise.all(
                        oBatch.map(async (c) => {
                            const { component, version, sequence } = c.bomComponent;

                            const aActualComponents = aData.filter(item =>
                                item.BOM_COMPONENT_MATERIAL === component &&
                                item.BOM_COMPONENT_MATERIAL_VERSION === version &&
                                item.BOM_COMPONENT_SEQUENCE === sequence
                            );

                            const enriched = await Promise.all(
                                aActualComponents.map(async (a) => {
                                    const description = await this.getMaterialText({
                                        plant: oRequest.plant,
                                        material: a.BOM_COMPONENT_MATERIAL
                                    });

                                    const oParams = {
                                        plant: oRequest.plant,
                                        sfc: oRequest.sfc,
                                        sfcAssyEventId: a.ID
                                    };
                                    const oDataFields = await this.getSfcAssemblyDataField(oParams);

                                    return {
                                        ...a,
                                        MATERIAL_DESCRIPTION: description,
                                        DATA_FIELDS: oDataFields ?? []
                                    };
                                })
                            );

                            c.actualComponents = enriched;

                            // componentState Filter
                            let bInclude = false;
                            switch (oRequest.componentState) {
                                case "All":
                                    bInclude = true;
                                    break;
                                case "Assembled":
                                    const assembled = c.actualComponents.filter(a => a.EVENT_TYPE !== "COMPONENT_REMOVE");
                                    if (assembled.length > 0) { c.actualComponents = assembled; bInclude = true; }
                                    break;
                                case "Unassembled":
                                    const hasRemoveEvents = c.actualComponents.some(a => a.EVENT_TYPE === "COMPONENT_REMOVE");
                                    bInclude = (c.actualComponents.length === 0 || hasRemoveEvents);
                                    break;
                                case "AssembledUnassembled":
                                    const assembledUnassembled = c.actualComponents.filter(a => a.EVENT_TYPE !== "COMPONENT_REMOVE");
                                    if (c.actualComponents.length === 0 || assembledUnassembled.length > 0) {
                                        c.actualComponents = assembledUnassembled;
                                        bInclude = true;
                                    }
                                    break;
                                case "Removed":
                                    const removed = c.actualComponents.filter(a => a.EVENT_TYPE === "COMPONENT_REMOVE");
                                    if (removed.length > 0) { c.actualComponents = removed; bInclude = true; }
                                    break;
                            }

                            return bInclude ? c : null;
                        })
                    );

                    results.filter(Boolean).forEach(r => {
                        const currentComponents = oAsBuiltModel.getProperty("/components") || [];
                        oAsBuiltModel.setProperty("/components", [...currentComponents, r]);
                    });

                    if (oAsBuiltModel.getProperty("/components").length > 0) {
                        oViewModel.setProperty("/busy", false);
                    }

                    // Update progress indicator
                    iLoaded += results.filter(Boolean).length;
                    const percent = Math.round((iLoaded / iTotal) * 100);
                    oAsBuiltModel.setProperty("/progress", {
                        percent,
                        display: `${percent}%`
                    });

                    // Give control to Event Loop
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

            } catch (oError) {
                MessageToast.show(oError.message);
            }
        },


        /**
         * Convert a key-value map into an OData filter string.
         *
         * @function _objectToODataFilterString
         * @param {Object.<string, (string|number|null|undefined)>} oFilterMap - 
         *        A map of filter keys and values. Keys are OData field names,
         *        values may be strings, numbers, null, or undefined.
         *        Undefined values are ignored.
         * @returns {string} An OData filter string composed of key-value pairs
         *        joined with "and". String values are quoted, null values are left unquoted.
         *
         * @example
         * // Returns "PLANT eq '1000' and SFC eq 'ABC123'"
         * _objectToODataFilterString({ PLANT: "1000", SFC: "ABC123" });
         *
         * @example
         * // Returns "PLANT eq '1000' and SFC_ASSEMBLY_EVENT_ID eq null"
         * _objectToODataFilterString({ PLANT: "1000", SFC_ASSEMBLY_EVENT_ID: null });
         */
        _objectToODataFilterString(oFilterMap) {
            return Object.entries(oFilterMap)
                .filter(([sKey, sValue]) => typeof sValue !== "undefined")
                .map(([sKey, sValue]) => `${sKey} eq ${quoteString(sValue)}`)
                .join(" and ");

            /**
             * Conditionally adds quotes around strings, accounting for null values.
             * @param {string|null} vValue
             * @returns {string}
             */
            function quoteString(vValue) {
                if (typeof vValue === "string") {
                    return `'${vValue}'`;
                }
                return vValue;
            }
        },
    }
});