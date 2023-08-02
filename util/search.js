const ConsonantMap = new Map([
    ['ㄱ', ['가', '까']],
    ['ㄲ', ['까', '나']],
    ['ㄴ', ['나', '다']],
    ['ㄷ', ['다', '따']],
    ['ㄸ', ['따', '라']],
    ['ㄹ', ['라', '마']],
    ['ㅁ', ['마', '바']],
    ['ㅂ', ['바', '빠']],
    ['ㅃ', ['빠', '사']],
    ['ㅅ', ['사', '싸']],
    ['ㅆ', ['싸', '아']],
    ['ㅇ', ['아', '자']],
    ['ㅈ', ['자', '짜']],
    ['ㅉ', ['짜', '차']],
    ['ㅊ', ['차', '카']],
    ['ㅋ', ['카', '타']],
    ['ㅌ', ['타', '파']],
    ['ㅍ', ['파', '하']],
    ['ㅎ', ['하', '힣']],
]);
exports.isConsonants = (word) => {
    return ![...word].some((c) => !ConsonantMap.has(c));
};

exports.getWhereClause = (word, column) => {
    const clause = [...word].reduce((p, c, i) => {
        if (!this.isConsonants(c)) {
            return p + `${column} LIKE '%${c}%' AND `;
        } else {
            return (
                p +
                `SUBSTR(${column}, ${i + 1}, 1) >= '${
                    ConsonantMap.get(c)[0]
                }' AND SUBSTR(${column}, ${i + 1}, 1) < '${ConsonantMap.get(c)[1]}' AND `
            );
        }
    }, '');
    return clause.substring(0, clause.length - 5);
};
