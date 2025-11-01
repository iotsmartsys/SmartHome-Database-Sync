

function getCurrentFormatedDate() {
    const now = new Date();
    return now.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19);
}

module.exports = {
    getCurrentFormatedDate
};