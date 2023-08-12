const moment = require('moment');

exports.cmpToday = (date) => {
    let result = moment(moment().format('YYYY-MM-DD')).isSame(moment(date.replaceAll('/', '-')));
    return result;
};

exports.isEmpty = function (value) {
    if (
        value == '' ||
        value == null ||
        value == undefined ||
        (value != null && typeof value == 'object' && !Object.keys(value).length)
    ) {
        return true;
    } else {
        return false;
    }
};
