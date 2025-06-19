var Sequelize = require('sequelize');
module.exports = function(sequelize, DataType){

    const dt_sqs_logs = sequelize.define('dt_sqs_logs', {

        id:{
            type: Sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        messageId:{
            type : Sequelize.STRING,
        },
        sqsMessage:{
            type : Sequelize.STRING,
        },
        isMessageSend:{
            type : Sequelize.STRING,
        },
        isMessageDelete:{
            type: Sequelize.STRING
        },
        createdAt : {
            type: Sequelize.DATE,
        },
        updatedAt:{
            type: Sequelize.DATE,
        }
    },
    {
        classMethods: {
        },
        freezeTableName: true,
    });

    return dt_sqs_logs;

};