let Sequelize = require('sequelize');

module.exports = (connection, DataType) => {
    let rptReversalRejectionMaster = connection.define('rptReversalRejectionMaster', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        reversal_status: Sequelize.STRING,
        transaction_status: Sequelize.STRING,
        reason_description: Sequelize.STRING,
        clear_bounce_flag: Sequelize.INTEGER,
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE
    },
        {
            freezeTableName: true
        });

    return rptReversalRejectionMaster;
};