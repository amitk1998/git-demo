let Sequelize = require('sequelize');

module.exports = (connection, DataType) => {
    let downloaded_merge_file_log = connection.define('downloaded_merge_file_log', {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        merge_batch_id: Sequelize.INTEGER,
        file_name: Sequelize.STRING,
        user_id: Sequelize.STRING,
        user_name: Sequelize.STRING,
        counter: Sequelize.STRING,
        file_downloaded_date: Sequelize.STRING,
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE
    },
        {
            classMethods: {
            },
            freezeTableName: true,
        });
    return downloaded_merge_file_log;
};