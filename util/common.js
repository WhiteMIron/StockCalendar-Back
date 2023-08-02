const moment = require('moment');

exports.cmpToday = async (date) => {
    let result = moment(moment().format('YYYY-MM-DD')).isSame(
        moment('2023/07/26'.replaceAll('/', '-'))
    );
    return result;
};
