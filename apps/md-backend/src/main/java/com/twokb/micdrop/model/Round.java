package com.twokb.micdrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "round")
@Data
@NoArgsConstructor
public class Round {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_round")
	private Integer idRound;

	@Column(name = "round_number", nullable = false)
	private Integer roundNumber;

	@Column(name = "active", nullable = false)
	private Boolean active;

	@Column(name = "group_count", nullable = false)
	private Integer groupCount;

	@Column(name = "submissions_open", nullable = false)
	private Boolean submissionsOpen;

	@Column(name = "elimination_amount", nullable = true)
	private Integer eliminationAmount;
}
