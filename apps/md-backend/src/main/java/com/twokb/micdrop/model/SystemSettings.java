package com.twokb.micdrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "system_setting")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SystemSettings {

	@Id
	@Column(name = "setting_key", length = 50)
	private String key;

	@Column(name = "setting_value", length = 100, nullable = false)
	private String value;

}
