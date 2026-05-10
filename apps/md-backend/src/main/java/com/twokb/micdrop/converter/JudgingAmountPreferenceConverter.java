package com.twokb.micdrop.converter;

import com.twokb.micdrop.model.JudgingAmountPreference;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class JudgingAmountPreferenceConverter implements AttributeConverter<JudgingAmountPreference, String> {

	@Override
	public String convertToDatabaseColumn(JudgingAmountPreference attribute) {
		// Convert from uppercase to lowercase for database storage
		if (attribute == null) {
			return null;
		}
		return attribute.name().toLowerCase();
	}

	@Override
	public JudgingAmountPreference convertToEntityAttribute(String dbData) {
		// Convert from lowercase to uppercase for entity usage
		if (dbData == null) {
			return null;
		}
		return JudgingAmountPreference.valueOf(dbData.toUpperCase());
	}

}
