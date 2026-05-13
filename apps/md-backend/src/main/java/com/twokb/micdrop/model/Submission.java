package com.twokb.micdrop.model;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinColumns;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "submission")
@Data
@NoArgsConstructor
public class Submission {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_submission")
	private Integer idSubmission;

	@Column(name = "sub_link", nullable = false)
	private String subLink;

	@Column(name = "score", nullable = true, precision = 4, scale = 2)
	private BigDecimal score;

	@Column(name = "review", nullable = true, length = 5000)
	private String review;

	@Column(name = "title", nullable = true)
	private String title;

	@Column(name = "artist", nullable = true)
	private String artist;

	@Column(name = "submitted_at", nullable = false)
	private Instant submittedAt;

	@Column(name = "id_contestant", nullable = false)
	private Integer idContestant;

	@Column(name = "id_judge", nullable = false)
	private Integer idJudge;

	@Column(name = "id_round", nullable = false)
	private Integer idRound;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumns({
			@JoinColumn(name = "id_contestant", referencedColumnName = "discord_user_id_user", insertable = false,
					updatable = false),
			@JoinColumn(name = "id_round", referencedColumnName = "round_id_round", insertable = false,
					updatable = false) })
	private UserRound contestant;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumns({
			@JoinColumn(name = "id_judge", referencedColumnName = "discord_user_id_user", insertable = false,
					updatable = false),
			@JoinColumn(name = "id_round", referencedColumnName = "round_id_round", insertable = false,
					updatable = false) })
	private UserRound judge;

}
