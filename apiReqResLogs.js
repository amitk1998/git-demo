const {Sequelize} = require('sequelize');

module.exports = function (sequelize, DataType) {

    const apiReqResLogs = sequelize.define('api_req_res_logs', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        api_module: {
            type: Sequelize.STRING,
        },
        client_ip: {
            type: Sequelize.STRING
        },
        client_name: {
            type: Sequelize.STRING,
        },
        headers: {
            type: Sequelize.TEXT('long')
        },
        request_body: {
            type: Sequelize.TEXT('long')
        },
        response_body: {
            type: Sequelize.TEXT('long')
        },
        third_party_req: {
            type: Sequelize.TEXT('long')
        },
        third_party_res: {
            type: Sequelize.TEXT('long')
        },
        api_error: {
            type: Sequelize.TEXT('long')
        }
    },
    {
        freezeTableName: true,
    });

    return apiReqResLogs;
};