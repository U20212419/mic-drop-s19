package com.twokb.micdrop.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.repository.RoundRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoundService {

	private final RoundRepository roundRepository;

	@Transactional(readOnly = true)
	public List<Round> getAllRounds() {
		return roundRepository.findAll();
	}

	@Transactional(readOnly = true)
	public Round getRound(Integer idRound) {
		return roundRepository.findById(idRound)
			.orElseThrow(() -> new IllegalArgumentException("Round with ID " + idRound + " not found."));
	}

	@Transactional
	public Round createRound(Integer roundNumber, Integer groupCount, String eliminationAmount, Boolean specialRound) {
		if (roundRepository.findByRoundNumber(roundNumber).isPresent()) {
			throw new IllegalArgumentException("Round number " + roundNumber + " already exists.");
		}

		var round = new com.twokb.micdrop.model.Round();
		round.setRoundNumber(roundNumber);
		round.setGroupCount(groupCount);
		round.setActive(false);
		round.setSubmissionsOpen(false);
		round.setEliminationAmount(eliminationAmount);
		round.setSpecialRound(specialRound);
		round.setRequireReasoning(false);
		round.setShowReasoningToJudges(false);
		round.setHasDropdownOptions(false);
		round.setDropdownOptions(null);
		round.setAllowDropdownRepeat(false);
		round.setMaxSelectionsPerOption(null);
		round.setSplitScore(false);
		round.setMaxSongScore(null);
		round.setMaxReasoningScore(null);

		return roundRepository.save(round);
	}

	@Transactional(readOnly = true)
	public Round getRoundByNumber(Integer roundNumber) {
		return roundRepository.findByRoundNumber(roundNumber)
			.orElseThrow(() -> new IllegalArgumentException("Round number " + roundNumber + " not found."));
	}

	@Transactional(readOnly = true)
	public Round getActiveRound() {
		List<Round> activeRounds = roundRepository.findAllByActiveTrue();

		if (activeRounds.isEmpty()) {
			throw new IllegalStateException("There is no active round to send a judging reminder for.");
		}
		if (activeRounds.size() > 1) {
			throw new IllegalStateException("More than one round is active. Please fix the round configuration first.");
		}

		return activeRounds.get(0);
	}

	@Transactional(readOnly = true)
	public Optional<Round> getActiveRoundOptional() {
		return roundRepository.findByActiveTrue();
	}

	@Transactional(readOnly = true)
	public Optional<Round> findActiveRound() {
		List<Round> activeRounds = roundRepository.findAllByActiveTrue();

		if (activeRounds.isEmpty()) {
			return Optional.empty();
		}
		if (activeRounds.size() > 1) {
			throw new IllegalStateException("More than one round is active. Please fix the round configuration first.");
		}

		return Optional.of(activeRounds.get(0));
	}

	@Transactional
	public Round updateRound(Integer idRound, Integer roundNumber, Boolean active, Integer groupCount,
			Boolean submissionsOpen, String eliminationAmount, Boolean specialRound, Boolean requireReasoning,
			Boolean showReasoningToJudges, Boolean hasDropdownOptions, String dropdownOptions,
			Boolean allowDropdownRepeat, Integer maxSelectionsPerOption, Boolean splitScore, Integer maxSongScore,
			Integer maxReasoningScore) {

		Round round = roundRepository.findById(idRound)
			.orElseThrow(() -> new IllegalArgumentException("Round with ID " + idRound + " not found."));

		if (!round.getRoundNumber().equals(roundNumber) && roundRepository.existsByRoundNumber(roundNumber)) {
			throw new IllegalArgumentException("Round number " + roundNumber + " already exists.");
		}

		// Validate split score logic
		if (Boolean.TRUE.equals(splitScore)) {
			if (maxSongScore == null || maxReasoningScore == null || (maxSongScore + maxReasoningScore != 10)) {
				throw new IllegalArgumentException(
						"If split score is enabled, song and reasoning maximum scores must sum exactly 10.");
			}
		}

		round.setRoundNumber(roundNumber);

		// If activating this round, ensure all other rounds are deactivated
		if (active) {
			roundRepository.deactivateAllRoundsExcept(idRound);
		}

		round.setActive(active);
		round.setGroupCount(groupCount);
		round.setSubmissionsOpen(submissionsOpen);
		round.setEliminationAmount(eliminationAmount);
		round.setSpecialRound(specialRound);
		round.setRequireReasoning(requireReasoning);
		round.setShowReasoningToJudges(showReasoningToJudges != null ? showReasoningToJudges : false);
		round.setHasDropdownOptions(hasDropdownOptions != null ? hasDropdownOptions : false);

		// Reset dropdown configuration if the feature is disabled
		if (!round.getHasDropdownOptions()) {
			round.setDropdownOptions(null);
			round.setAllowDropdownRepeat(false);
			round.setMaxSelectionsPerOption(null);
		}
		else {
			round.setDropdownOptions(dropdownOptions);
			round.setAllowDropdownRepeat(allowDropdownRepeat != null ? allowDropdownRepeat : false);
			round.setMaxSelectionsPerOption(maxSelectionsPerOption);
		}

		round.setSplitScore(splitScore != null ? splitScore : false);

		// Reset split score configuration if the feature is disabled
		if (!round.getSplitScore()) {
			round.setMaxSongScore(null);
			round.setMaxReasoningScore(null);
		}
		else {
			round.setMaxSongScore(maxSongScore);
			round.setMaxReasoningScore(maxReasoningScore);
		}

		return round;
	}

	@Transactional
	public void deleteRound(Integer idRound) {
		Round round = roundRepository.findById(idRound)
			.orElseThrow(() -> new IllegalArgumentException("Round with ID " + idRound + " not found."));

		if (round.getActive()) {
			throw new IllegalStateException("Cannot delete an active round. Please deactivate it first.");
		}

		// If the round is associated with any other records in the database,
		// the global exception handler will catch the DataIntegrityViolationException
		roundRepository.delete(round);
	}

	@Transactional(readOnly = true)
	public Optional<Round> getPreviousRound(Integer currentRoundNumber) {
		return roundRepository.findFirstByRoundNumberLessThanOrderByRoundNumberDesc(currentRoundNumber);
	}

	@Transactional(readOnly = true)
	public Integer getPreviousNormalRoundNumber(int currentRound) {
		return roundRepository.findPreviousNormalRoundNumber(currentRound);
	}

}
