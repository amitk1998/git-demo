var Sequelize = require('sequelize');

module.exports = function(connection, DataType){

	var registration_rejection = connection.define('registration_rejection', {
		id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement:true

        },
		registration_rejection_code: {
			type: Sequelize.STRING(100),  unique: 'compositeIndex'
		},
		mandate_type: {
			type: Sequelize.STRING(200),  unique: 'compositeIndex'
		},
		sourse_system: {
			type: Sequelize.STRING(200),  unique: 'compositeIndex'
		},
		bank_code: {
			type: Sequelize.STRING(200),  unique: 'compositeIndex'
		},
		registration_rejection_name: Sequelize.STRING,
		registration_bank_res_status_name: Sequelize.STRING,
		report_rejection_status: Sequelize.STRING,
		report_rejection_code: Sequelize.STRING,
		registration_isActive: Sequelize.BOOLEAN
	},

	{
		classMethods: {

		},
    freezeTableName: true,
});

	return registration_rejection;
};


