package com.twokb.micdrop.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.myRounds.AdminBatchUpdateRequest;
import com.twokb.micdrop.dto.myRounds.AdminSubmissionDTO;
import com.twokb.micdrop.dto.myRounds.AdminSubmissionUpdateDTO;
import com.twokb.micdrop.model.ContestantStatus;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoundDetailService {
    private final DiscordUserService discordUserService;

    private final UserRoundService userRoundService;

    private final SubmissionService submissionService;

    private final RoundService roundService;

    @Transactional(readOnly = true)
    public List<AdminSubmissionDTO> getRoundSubmissions(Integer idRound) {
        List<Submission> subs = submissionService.getSubmissionsByRoundId(idRound);
        
        Map<Integer, DiscordUser> userMap = discordUserService.getAllUsers().stream()
            .collect(Collectors.toMap(DiscordUser::getIdUser, Function.identity()));
        
        List<UserRound> userRounds = userRoundService.getUserRoundsByRoundId(idRound);
        Map<Integer, Integer> groupMap = userRounds.stream()
            .filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
            .collect(Collectors.toMap(ur -> ur.getId().getUserId(), UserRound::getGroupNumber));

        return subs.stream().map(s -> {
            DiscordUser judge = userMap.get(s.getIdJudge());
            DiscordUser contestant = userMap.get(s.getIdContestant());
            Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);

            return new AdminSubmissionDTO(
                s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
                s.getTitle(), s.getArtist(),
                judge.getDiscordId(), judge.getUsername(),
                contestant.getDiscordId(), contestant.getUsername(),
                group, s.getSubmittedAt()
            );
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminSubmissionDTO> getRoundSubmissionsByIds(Set<Integer> submissionIds) {
        List<Submission> subs = submissionService.getByIds(submissionIds);

        Map<Integer, DiscordUser> userMap = discordUserService.getAllUsers().stream()
            .collect(Collectors.toMap(DiscordUser::getIdUser, Function.identity()));

        Map<Integer, Integer> groupMap = userRoundService.getUserRoundsByRoundId(subs.get(0).getIdRound()).stream()
            .filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
            .collect(Collectors.toMap(ur -> ur.getId().getUserId(), UserRound::getGroupNumber));

        return subs.stream().map(s -> {
            DiscordUser judge = userMap.get(s.getIdJudge());
            DiscordUser contestant = userMap.get(s.getIdContestant());
            Integer group = groupMap.getOrDefault(contestant.getIdUser(), 1);

            return new AdminSubmissionDTO(
                s.getIdSubmission(), s.getSubLink(), s.getScore(), s.getReview(),
                s.getTitle(), s.getArtist(),
                judge.getDiscordId(), judge.getUsername(),
                contestant.getDiscordId(), contestant.getUsername(),
                group, s.getSubmittedAt()
            );
        }).toList();
    }

    @Transactional
    public List<AdminSubmissionDTO> updateSubmissions(Integer idRound, AdminBatchUpdateRequest request) {
        for (AdminSubmissionUpdateDTO update : request.updates()) {
            submissionService.adminUpdateSubmission(
                update.idSubmission(),
                update.subLink(),
                update.title(),
                update.artist()
            );
        }

        Set<Integer> updatedIds = request.updates().stream()
            .map(AdminSubmissionUpdateDTO::idSubmission)
            .collect(Collectors.toSet());

        return getRoundSubmissionsByIds(updatedIds);
    }

    @Transactional
    public void executeEliminations(Integer idRound, Integer groupNumber) {
        Round round = roundService.getRound(idRound);

        if (round.getSubmissionsOpen() || round.getEliminationAmount() == null || round.getEliminationAmount() <= 0) {
            throw new IllegalStateException("Round is not ready for eliminations. Check round configuration.");
        }

        List<UserRound> groupUsers = userRoundService.getUsersByRoundIdAndGroupNumber(idRound, groupNumber);

        List<DiscordUser> contestants = groupUsers.stream()
            .filter(ur -> ur.getUserRole() == UserRoleType.CONTESTANT)
            .map(UserRound::getUser)
            .toList();
        
        List<DiscordUser> judges = groupUsers.stream()
            .filter(ur -> ur.getUserRole() == UserRoleType.JUDGE)
            .map(UserRound::getUser)
            .toList();
        
        int expectedSubmissionsPerContestant = judges.size();

        // Calculate average scores for each contestant
        record ContestantStat(DiscordUser contestant, double avgScore, double stdDev, Instant maxSubmittedAt) {}
        List<ContestantStat> activeStats = new ArrayList<>();
        
        for (DiscordUser contestant : contestants) {
            List<Submission> subs = submissionService.getByRoundIdAndContestantIdAndJudgeIds(
                idRound, contestant.getIdUser(), judges.stream().map(DiscordUser::getIdUser).toList()
            );

            long submittedCount = subs.stream().filter(s -> s.getSubLink() != null && !s.getSubLink().isBlank()).count();

            // If contestant didn't submit to all judges, mark as DID_NOT_SUBMIT
            if (submittedCount < expectedSubmissionsPerContestant) {
                contestant.setStatus(ContestantStatus.DID_NOT_SUBMIT);
                continue;
            }

            // Calculate average score
            double avgScore = subs.stream()
                .mapToDouble(s -> s.getScore() != null ? s.getScore().doubleValue() : 0.0)
                .average().orElse(0.0);
            
            // Calculate standard deviation (first tie-breaking criteria)
            double variance = subs.stream()
                .mapToDouble(s -> s.getScore() != null ? Math.pow(s.getScore().doubleValue() - avgScore, 2) : 0.0)
                .average().orElse(0.0);
            
            double stdDev = Math.sqrt(variance);

            // Get the latest submission time (second tie-breaking criteria)
            Instant maxSubmittedAt = subs.stream()
                .map(Submission::getSubmittedAt)
                .filter(Objects::nonNull)
                .max(Instant::compareTo)
                .orElse(Instant.EPOCH);
            
            activeStats.add(new ContestantStat(contestant, avgScore, stdDev, maxSubmittedAt));
        }

        // Sort by average score ascending, then std dev descending, then max submission time ascending
        activeStats.sort((a, b) -> {
            int scoreCmp = Double.compare(a.avgScore, b.avgScore);
            if (scoreCmp != 0) return scoreCmp;

            int stdDevCmp = Double.compare(b.stdDev, a.stdDev);
            if (stdDevCmp != 0) return stdDevCmp;

            return a.maxSubmittedAt.compareTo(b.maxSubmittedAt);
        });

        int eliminateCount = Math.min(round.getEliminationAmount(), activeStats.size());

        for (int i = 0; i < activeStats.size(); i++) {
            DiscordUser contestant = activeStats.get(i).contestant;

            if (i < eliminateCount) {
                contestant.setStatus(ContestantStatus.ELIMINATED);
            }
            else {
                contestant.setStatus(ContestantStatus.ACTIVE);
            }
        }
    }
}
