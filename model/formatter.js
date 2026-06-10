sap.ui.define([
    "sap/dm/dme/pod2/context/PodContext",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/date/UI5Date",
], function (PodContext, DateFormat, UI5Date) {
    "use strict";

    return {
        getValueAndVersion: function (sMaterial, sVersion) {
            return sMaterial ? `${sMaterial}/${sVersion}` : '';
        },

        getEventTypeText: function (sEventType) {
            const oBundle = new sap.ui.model.resource.ResourceModel(
                { bundleName: "mhp.pod2.zplugins.asbuiltreportplugin.i18n.i18n" }).getResourceBundle();

            switch (sEventType) {
                case 'COMPONENT_REMOVE':
                    return oBundle.getText("asBuilt.componentRemove");
                    break;
                case 'COMPONENT_ADD':
                    return oBundle.getText("asBuilt.componentAdd");
                    break;
                default:
                    return '';
            }
        },

        getEventTypeState: function (sEventType) {
            switch (sEventType) {
                case 'COMPONENT_REMOVE':
                    return 'Error';
                    break;
                case 'COMPONENT_ADD':
                    return 'Success';
                    break;
                default:
                    return '';
            }
        },

        /**
         * Converts a UTC/ISO input string into a timezone-corrected, formatted string.
         *
         * @param {string} sDate - Input date string in UTC/ISO format.
         *   Examples:
         *   - UTC: "2020-10-23T05:13:45Z"
         *   - ISO: "2020-10-23T05:13:45.000Z"
         * @returns {string} Localized date-time string adjusted to the plant timezone.
         *   Example output: "May 14, 2026, 6:15:01 PM Europe, Berlin"
         */
        dmcTimeZoneDate: function (sDate) {
            const sTimezone = PodContext.getPlantTimeZone(),
                oDate = UI5Date.getInstance(sDate);

            return DateFormat.getDateTimeWithTimezoneInstance().format(oDate, sTimezone);
        },

        findDataField(aDataValues, sDataField) {
            const oDataValue = aDataValues.find((item) => item.DATA_FIELD_LABEL == sDataField);

            return oDataValue?.DATA_FIELD_VALUE ?? '';
        },

    };
});