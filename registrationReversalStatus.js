var Sequelize = require('sequelize');

module.exports = function(connection, DataType){

	var registrationReversalStatus = connection.define('registrationReversalStatus', {
		batch_id: {
			type:Sequelize.INTEGER,
			primaryKey:true,
			autoIncrement:true
		},
		upload_date_time: Sequelize.STRING,
		user_name: Sequelize.STRING,
		user_code: Sequelize.STRING,
		upload_status: Sequelize.STRING,
		total_count: Sequelize.STRING,
		succuss_count: Sequelize.STRING,
		rejected_count:Sequelize.STRING,
		pending_count:Sequelize.STRING,
		file_name: Sequelize.STRING
	},

	{
		classMethods: {
			associate: function(models) {
  		}

		},
    freezeTableName: true,
});

	return registrationReversalStatus;
};


