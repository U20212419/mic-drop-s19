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
	public Round createRound(Integer roundNumber, Integer groupCount) {
		if (roundRepository.findByRoundNumber(roundNumber).isPresent()) {
			throw new IllegalArgumentException("Round number " + roundNumber + " already exists.");
		}

		var round = new com.twokb.micdrop.model.Round();
		round.setRoundNumber(roundNumber);
		round.setGroupCount(groupCount);
		round.setActive(false);
		return roundRepository.save(round);
	}

	@Transactional
	public void setActiveRound(Integer roundNumber) {
		var currentActiveRoundOpt = roundRepository.findByActiveTrue();
		if (currentActiveRoundOpt.isPresent()) {
			var currentActiveRound = currentActiveRoundOpt.get();
			if (currentActiveRound.getRoundNumber() == roundNumber) {
				return; // Already active, no change needed
			}
			currentActiveRound.setActive(false);
		}

		var newActiveRound = roundRepository.findByRoundNumber(roundNumber)
			.orElseThrow(() -> new IllegalArgumentException("Round number " + roundNumber + " not found."));

		newActiveRound.setActive(true);
	}

	@Transactional(readOnly = true)
	public Round getRoundByNumber(Integer roundNumber) {
		return roundRepository.findByRoundNumber(roundNumber)
			.orElseThrow(() -> new IllegalArgumentException("Round number " + roundNumber + " not found."));
	}

	@Transactional
	public Round updateRound(Integer idRound, Integer roundNumber, Boolean active, Integer groupCount) {
		Round round = roundRepository.findById(idRound)
			.orElseThrow(() -> new IllegalArgumentException("Round with ID " + idRound + " not found."));

		if (!round.getRoundNumber().equals(roundNumber) && roundRepository.existsByRoundNumber(roundNumber)) {
			throw new IllegalArgumentException("Round number " + roundNumber + " already exists.");
		}

		round.setRoundNumber(roundNumber);

		// If activating this round, ensure all other rounds are deactivated
		if (active) {
			roundRepository.deactivateAllRoundsExcept(idRound);
		}

		round.setActive(active);
		round.setGroupCount(groupCount);

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

}
