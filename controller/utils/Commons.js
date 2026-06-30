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
         * Retrieves material descriptions from the MDO service and returns them as a Map keyed by material and version.
         *
         * @async
         * @function getMaterialsDescription
         * @param {object} oRequest - Request parameters for the material text lookup.
         * @param {string[]} aMaterials - The list of materials to retrieve descriptions for.
         * @returns {Promise<Map<string, object>>} A promise resolving to a map of material descriptions.
         * @memberOf mhp.pod2.zplugins.AsBuiltReportPlugin.controller.Commons
         */
        getMaterialsDescription: async function (oRequest, aMaterials) {
            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                IS_DELETED: "false",
                LOCALE: oRequest.locale,
                MATERIAL: aMaterials
            });

            const mMaterialsDescr = new Map();

            const oParameters = {
                $skip: oRequest.skip || 0,
                $top: oRequest.top || 1000,
                $filter: sFilter,
                $select: "MATERIAL,MATERIAL_VERSION,DESCRIPTION",
            };
            const [ aResponse ] = await oMdoClient.getPage(MDO.MaterialText, oParameters);
            
            // Create a Map
            aResponse.forEach((oItem) => {
                const sKey = [
                    oItem.MATERIAL,
                    oItem.MATERIAL_VERSION
                ].join("|");

                if (!mMaterialsDescr.has(sKey)) {
                    mMaterialsDescr.set(sKey, oItem);
                }
            });

            return mMaterialsDescr;
        },

        /**
         * Retrieves the material text for a specific material and version from the MDO service.
         *
         * @async
         * @function getMaterialText
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.material - Material identifier.
         * @param {string} oRequest.materialVersion - Material version.
         * @param {number} [oRequest.skip=0] - Number of records to skip for pagination.
         * @param {number} [oRequest.top=1] - Maximum number of records to retrieve.
         * @returns {Promise<Object>} A promise that resolves to the matching material text object,
         * or an empty object when no description is found.
         */
        getMaterialText: async function (oRequest) {
            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                MATERIAL: oRequest.material,
                MATERIAL_VERSION: oRequest.materialVersion
            });

            const oParameters = {
                $skip: oRequest.skip || 0,
                $top: oRequest.top || 1,
                $filter: sFilter,
                $select: "MATERIAL,MATERIAL_VERSION,DESCRIPTION",
            };
            const [[aResponse]] = await oMdoClient.getPage(MDO.MaterialText, oParameters);
            return aResponse || {};
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
         * Retrieves SFC assembly data field records from the MDO service.
         *
         * @async
         * @function getSfcAssemblyDataFields
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - Shop Floor Control (SFC) identifier.
         * @returns {Promise<Map<string, Object>>} A promise that resolves to a map of SFC assembly data field records keyed by event ID.
         */
        getSfcAssemblyDataFields: async function (oRequest) {
            const sFilter = this._objectToODataFilterString({
                PLANT: oRequest.plant,
                SFC: oRequest.sfc,
                IS_DELETED: 'false',
            });

            const mSfcDataFields = new Map();
            const iTop = 1000;
            let iSkip = 0, 
                bFindedAllRecords = false;

            try {
                while(!bFindedAllRecords) {
                    const oParameters = {
                        $skip: iSkip,
                        $top: iTop,
                        $filter: sFilter,
                        $select: `COMPONENT_INVENTORY,DATA_FIELD_LABEL,DATA_FIELD_VALUE,SFC_ASSEMBLY_EVENT_ID`,
                    };
                    
                    const [aResponse] = await oMdoClient.getPage(MDO.SFCAssemblyDataField, oParameters);
                                
                    // Add records to the Map
                    aResponse.forEach((oItem) => {
                        const sKey = oItem.SFC_ASSEMBLY_EVENT_ID;

                        if (!mSfcDataFields.has(sKey)) {
                            mSfcDataFields.set(sKey, oItem);
                        }
                    });

                    if (aResponse.length < iTop) {
                        console.log("##            Less than 1000.          ##");
                        bFindedAllRecords = true;
                    } else {
                        iSkip += 1000;
                        console.log("##  More than 1000. Do next iteration  ##");
                    }
                }
            } catch (error) {
                throw new Error(error.message);
            }


            return mSfcDataFields;
        },

        /**
         * Retrieves SFC assembly data field records for a specific assembly event ID from the MDO service.
         *
         * @async
         * @function getSfcAssemblyDataFields_byEventId
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - Shop Floor Control (SFC) identifier.
         * @param {string|undefined} oRequest.sfcAssyEventId - SFC assembly event ID to filter by.
         * @param {number} [oRequest.skip=0] - Number of records to skip for pagination.
         * @param {number} [oRequest.top=1000] - Maximum number of records to retrieve.
         * @returns {Promise<Object[]>} A promise that resolves to an array of assembly data field objects,
         * each including COMPONENT_INVENTORY, DATA_FIELD_LABEL, DATA_FIELD_VALUE, and IS_DELETED.
         */
        getSfcAssemblyDataFields_byEventId: async function (oRequest) {
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
         * Retrieves and enriches assembled component data for a given SFC request.
         *
         * @async
         * @function getAssembledComponents
         * @param {Object} oRequest - Request parameters for the query.
         * @param {string} oRequest.plant - Plant identifier.
         * @param {string} oRequest.sfc - Shop Floor Control (SFC) identifier.
         * @param {string} [oRequest.componentState="All"] - Component state filter
         *        ("All", "Assembled", "Unassembled", "AssembledUnassembled", "Removed").
         * @param {Object} oBomComponents - BOM components structure containing a `components` array.
         * @param {Object[]} oBomComponents.components - List of BOM components to process.
         * @param {Object} oBomComponents.components[].bomComponent - BOM component metadata
         *        including `component`, `version`, and `sequence`.
         * @param {sap.ui.model.json.JSONModel} oAsBuiltModel - JSON model used to store the enriched result set.
         * @param {sap.ui.model.json.JSONModel} oViewModel - View model used to control busy state and progress UI.
         * @returns {Promise<void>} A promise that resolves once the filtered and enriched components have been
         * written to the provided model and the progress state has been updated.
         *
         * @description
         * This function now:
         * 1. Loads assembly events, assembly data fields, and material descriptions in parallel.
         * 2. Filters the BOM components by the selected component-state rule before processing.
         * 3. Matches BOM components with actual assembly events by material, version, and sequence.
         * 4. Enriches each matched component with material descriptions and data fields.
         * 5. Updates the UI model progressively in batches and refreshes the progress indicator.
         * Errors are caught and surfaced through a MessageToast.
         */
        getAssembledComponents: async function (oRequest, oBomComponents, oAsBuiltModel, oViewModel) {
            // const iStartTime = performance.now();
            const aComponents = oBomComponents.components || [];
            const aMaterials = Array.from(
                new Set(
                    aComponents
                        .map(item => item.bomComponent.component)
                        .filter(Boolean)
                )
            );

            // Determines whether the component should be included based on the selected component state.
            const isComponentIncluded = (aActualComponents) => {
                switch (oRequest.componentState) {
                    case "All":
                        return true;
                    case "Assembled":
                        return aActualComponents.some(a => a.EVENT_TYPE !== "COMPONENT_REMOVE");
                    case "Unassembled":
                        return aActualComponents.length === 0 || aActualComponents.some(a => a.EVENT_TYPE === "COMPONENT_REMOVE");
                    case "AssembledUnassembled":
                        return aActualComponents.length === 0 || aActualComponents.some(a => a.EVENT_TYPE !== "COMPONENT_REMOVE");
                    case "Removed":
                        return aActualComponents.some(a => a.EVENT_TYPE === "COMPONENT_REMOVE");
                    default:
                        return true;
                }
            };

            try {
                // Run the data-loading calls in parallel to reduce wait time
                const [
                    oAssyEvents,
                    mSfcDataFields,
                    mMaterialDescriptions
                ] = await Promise.all([
                    this.getSfcAssemblyEvents(oRequest),
                    this.getSfcAssemblyDataFields(oRequest),
                    this.getMaterialsDescription(oRequest, aMaterials)
                ]);

                const aComponentsToProcess = aComponents.reduce((aResult, c) => {
                    const { component, version, sequence } = c.bomComponent;
                    const aActualComponents = oAssyEvents.filter(item =>
                        item.BOM_COMPONENT_MATERIAL === component &&
                        item.BOM_COMPONENT_MATERIAL_VERSION === version &&
                        item.BOM_COMPONENT_SEQUENCE === sequence
                    );

                    if (isComponentIncluded(aActualComponents)) {
                        aResult.push({ c, aActualComponents });
                    }

                    return aResult;
                }, []);

                const iTotal = aComponentsToProcess.length;
                let iLoaded = 0;

                // Batch Size to process components in smaller groups (5 at a time)
                const iBatchSize = 5;

                for (let i = 0; i < aComponentsToProcess.length; i += iBatchSize) {
                    const oBatch = aComponentsToProcess.slice(i, i + iBatchSize);

                    const results = await Promise.all(
                        oBatch.map(async ({ c, aActualComponents }) => {

                            const enriched = await Promise.all(
                                aActualComponents.map(async (a) => {

                                    // Search Material Description in the Map. If doesn't exist, call the MaterialText function
                                    const sMaterialKey = [a.BOM_COMPONENT_MATERIAL, a.BOM_COMPONENT_MATERIAL_VERSION].join('|');
                                    let oMaterialDescr = mMaterialDescriptions.get(sMaterialKey);
                                    let sDescription = '';
                                    
                                    if (oMaterialDescr) {
                                        sDescription = oMaterialDescr.DESCRIPTION;
                                    } else {
                                        oMaterialDescr = await this.getMaterialText({
                                            plant: oRequest.plant,
                                            material: a.BOM_COMPONENT_MATERIAL,
                                            materialVersion: a.BOM_COMPONENT_MATERIAL_VERSION
                                        });

                                        if (!oMaterialDescr) return;

                                        sDescription = oMaterialDescr.oMaterialDescr;

                                        // Add to the Map
                                        mMaterialDescriptions.set(sMaterialKey, oMaterialDescr);
                                    }

                                    // Search data fields in the Map
                                    let oItemDataFields = mSfcDataFields.get(a.ID);
                                    if (!Array.isArray(oItemDataFields) && oItemDataFields) {
                                        oItemDataFields = [oItemDataFields];
                                    }

                                    return {
                                        ...a,
                                        MATERIAL_DESCRIPTION: sDescription,
                                        DATA_FIELDS: oItemDataFields ?? []
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
                // const iElapsedTime = performance.now() - iStartTime;
                // console.error(`[getAssembledComponents] Failed after ${iElapsedTime.toFixed(2)} ms:`, oError);
                MessageToast.show(oError.message);
            }
            // const iElapsedTime = performance.now() - iStartTime;
            // console.log(`[getAssembledComponents] Completed in ${iElapsedTime.toFixed(2)} ms for SFC ${oRequest.sfc}.`);
        },

        /**
         * Convert a key-value map into an OData filter string.
         *
         * @function _objectToODataFilterString
         * @param {Object.<string, (string|number|Array|null|undefined)>} oFilterMap - 
         *        A map of filter keys and values. Keys are OData field names,
         *        values may be strings, numbers, arrays, null, or undefined.
         *        Undefined values are ignored.
         * @returns {string} An OData filter string composed of key-value pairs
         *        joined with "and". String values are quoted, null values are left unquoted.
         *
         * @example
         * // Returns "PLANT eq '1000' and SFC eq 'ABC123'"
         * _objectToODataFilterString({ PLANT: "1000", SFC: "ABC123" });
         *
         * @example
         * // Returns "MATERIAL eq 'mat1' or MATERIAL eq 'mat2'"
         * _objectToODataFilterString({ MATERIAL: ["mat1", "mat2"] });
         */
        _objectToODataFilterString(oFilterMap) {
            return Object.entries(oFilterMap)
                .filter(([sKey, sValue]) => {
                    if (typeof sValue === "undefined") return false;
                    if (Array.isArray(sValue) && sValue.length === 0) return false;
                    return true;
                })
                .map(([sKey, sValue]) => {
                    if (Array.isArray(sValue)) {
                        // Genera (key eq 'val1' or key eq 'val2' ...)
                        return "(" + sValue.map(v => `${sKey} eq ${quoteString(v)}`).join(" or ") + ")";
                    }
                    return `${sKey} eq ${quoteString(sValue)}`;
                })
                .join(" and ");

            function quoteString(vValue) {
                if (typeof vValue === "string") {
                    return `'${vValue}'`;
                }
                return vValue;
            }
        },

    }
});