package com.twokb.micdrop.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.repository.RoundRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoundService {
    private final RoundRepository roundRepository;

    @Transactional
    public void createRound(int roundNumber) {
        if (roundRepository.findByRoundNumber(roundNumber).isPresent()) {
            throw new IllegalArgumentException("Round with number " + roundNumber + " already exists");
        }

        var round = new com.twokb.micdrop.model.Round();
        round.setRoundNumber(roundNumber);
        round.setActive(false);
    }

    @Transactional
    public void setActiveRound(int roundNumber) {
        var currentActiveRoundOpt = roundRepository.findByActiveTrue();
        if (currentActiveRoundOpt.isPresent()) {
            var currentActiveRound = currentActiveRoundOpt.get();
            if (currentActiveRound.getRoundNumber() == roundNumber) {
                return; // Already active, no change needed
            }
            currentActiveRound.setActive(false);
        }

        var newActiveRound = roundRepository.findByRoundNumber(roundNumber)
            .orElseThrow(() -> new IllegalArgumentException("Round with number " + roundNumber + " not found"));

        newActiveRound.setActive(true);
    }
}
