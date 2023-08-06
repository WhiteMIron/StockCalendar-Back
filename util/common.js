const moment = require('moment');

exports.cmpToday = (date) => {
    let result = moment(moment().format('YYYY-MM-DD')).isSame(moment(date.replaceAll('/', '-')));
    return result;
};
