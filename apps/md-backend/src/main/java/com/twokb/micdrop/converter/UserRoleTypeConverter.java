package com.twokb.micdrop.converter;

import com.twokb.micdrop.model.UserRoleType;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class UserRoleTypeConverter implements AttributeConverter<UserRoleType, String> {

	@Override
	public String convertToDatabaseColumn(UserRoleType attribute) {
		// Convert from uppercase to lowercase for database storage
		if (attribute == null) {
			return null;
		}
		return attribute.name().toLowerCase();
	}

	@Override
	public UserRoleType convertToEntityAttribute(String dbData) {
		// Convert from lowercase to uppercase for entity usage
		if (dbData == null) {
			return null;
		}
		return UserRoleType.valueOf(dbData.toUpperCase());
	}

}
