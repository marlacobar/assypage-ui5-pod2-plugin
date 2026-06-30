sap.ui.define([
    "sap/dm/dme/pod2/context/PodContext",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/date/UI5Date",
], function (PodContext, DateFormat, UI5Date) {
    "use strict";

    return {
        /**
         * Formats a material and its version as a single display value.
         *
         * @param {string} sMaterial - Material identifier.
         * @param {string} sVersion - Material version.
         * @returns {string} A formatted material/version string.
         */
        getValueAndVersion: function (sMaterial, sVersion) {
            return sMaterial ? `${sMaterial}/${sVersion}` : '';
        },

        /**
         * Returns the localized label for the given event type.
         *
         * @param {string} sEventType - Event type code.
         * @returns {string} The localized event type text.
         */
        getEventTypeText: function (sEventType) {
            const oBundle = new sap.ui.model.resource.ResourceModel(
                { bundleName: "mhp.pod2.zplugins.AsBuiltReportPlugin.i18n.i18n" }).getResourceBundle();

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

        /**
         * Returns the UI state for the given event type.
         *
         * @param {string} sEventType - Event type code.
         * @returns {string} The corresponding UI state value.
         */
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

        /**
         * Finds a data field value by its label within a data field array.
         *
         * @param {Array<Object>} aDataValues - List of data field values.
         * @param {string} sDataField - Data field label to search for.
         * @returns {string} The matching data field value or an empty string.
         */
        findDataField(aDataValues, sDataField) {
            if (!aDataValues) return;

            const oDataValue = aDataValues.find((item) => item.DATA_FIELD_LABEL == sDataField);

            return oDataValue?.DATA_FIELD_VALUE ?? '';
        },

    };
});