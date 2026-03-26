package com.twokb.micdrop.converter;

import com.twokb.micdrop.model.ContestantStatus;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ContestantStatusConverter implements AttributeConverter<ContestantStatus, String> {

	@Override
	public String convertToDatabaseColumn(ContestantStatus attribute) {
		// Convert from uppercase to lowercase for database storage
		if (attribute == null) {
			return null;
		}
		return attribute.name().toLowerCase();
	}

	@Override
	public ContestantStatus convertToEntityAttribute(String dbData) {
		// Convert from lowercase to uppercase for entity usage
		if (dbData == null) {
			return null;
		}
		return ContestantStatus.valueOf(dbData.toUpperCase());
	}

}
