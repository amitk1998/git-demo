const Sequelize = require('sequelize');

module.exports = (connection, DataTypes) => {
    const file_execution_logs = connection.define('file_execution_logs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      file_name: {
        type: Sequelize.STRING,
      },
      s3_file_location: {
        type: Sequelize.STRING,
      },
      uploaded_by: {
        type: Sequelize.STRING,

      },
      total_records: {
        type: Sequelize.INTEGER,

      },
      success_records: {
        type: Sequelize.INTEGER,

      },
      failed_records: {
        type: Sequelize.INTEGER,
      },
      file_status: {
        type: Sequelize.STRING,
      },
      mandate_type :{
        type: Sequelize.STRING,
      },
      company_code :{
        type: Sequelize.STRING,
      },
      mandate_type :{
        type: Sequelize.STRING,
      },
      company_code :{
        type: Sequelize.STRING,
      }
    }, {
      tableName: 'file_execution_logs',
      timestamps: true, 
    });
  
    return file_execution_logs;
  };
  