let Sequelize = require('sequelize');

module.exports = function(connection, DataType){

	let download_status = connection.define('download_status', {
		batch_id: Sequelize.STRING,
		source_system: Sequelize.STRING,
		download_id: Sequelize.STRING,
		status:Sequelize.STRING
	},

	{
		classMethods: {

		},
    freezeTableName: true,
});

	return download_status;
};

