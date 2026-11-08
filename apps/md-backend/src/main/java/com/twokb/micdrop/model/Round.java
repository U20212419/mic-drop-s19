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
	private String eliminationAmount;

	@Column(name = "special_round", nullable = false)
	private Boolean specialRound = false;

	@Column(name = "require_reasoning", nullable = false)
	private Boolean requireReasoning = false;

	@Column(name = "show_reasoning_to_judges", nullable = false)
	private Boolean showReasoningToJudges = false;

	@Column(name = "has_dropdown_options", nullable = false)
	private Boolean hasDropdownOptions = false;

	@Column(name = "dropdown_options", nullable = true)
	private String dropdownOptions;

	@Column(name = "allow_dropdown_repeat", nullable = false)
	private Boolean allowDropdownRepeat = false;

	@Column(name = "max_selections_per_option", nullable = true)
	private Integer maxSelectionsPerOption;

	@Column(name = "split_score", nullable = false)
	private Boolean splitScore = false;

	@Column(name = "max_song_score", nullable = true)
	private Integer maxSongScore;

	@Column(name = "max_reasoning_score", nullable = true)
	private Integer maxReasoningScore;

}
