package com.twokb.micdrop.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import com.twokb.micdrop.dto.myRounds.SubmitLinkRequest;
import com.twokb.micdrop.model.CollectionItem;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Submission;
import com.twokb.micdrop.repository.CollectionItemRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CollectionItemService {

	private final CollectionItemRepository collectionItemRepository;

	private final SubmissionService submissionService;

	@Transactional
	public void deductFromCollection(DiscordUser contestant, List<SubmitLinkRequest> submissions) {
		Map<String, Long> submittedCounts = submissions.stream()
			.map(s -> HtmlUtils.htmlUnescape(s.subLink()))
			.collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));

		List<CollectionItem> collection = getCollectionForUser(contestant);

		for (Map.Entry<String, Long> entry : submittedCounts.entrySet()) {
			String linkToDeduct = entry.getKey();
			long countToDeduct = entry.getValue();

			// Filter the rows that match the submitted link
			List<CollectionItem> matchingCopies = collection.stream()
				.filter(ci -> ci.getSubLink().equals(linkToDeduct) || isSameSong(ci, linkToDeduct))
				.limit(countToDeduct)
				.toList();

			if (matchingCopies.size() < countToDeduct) {
				throw new IllegalArgumentException("Not enough copies in collection for song: " + linkToDeduct);
			}

			// Delete the matching copies from the collection
			collectionItemRepository.deleteAll(matchingCopies);
			collection.removeAll(matchingCopies); // Update the local collection list
		}
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, List<SubmitLinkRequest> submissions, int judgeAmount) {
		long collectionAdditions = submissions.stream().filter(s -> Boolean.TRUE.equals(s.addToCollection())).count();

		if (judgeAmount > 3 && collectionAdditions != 3) {
			throw new IllegalArgumentException("You must select exactly 3 songs to add to your collection.");
		}

		for (SubmitLinkRequest slr : submissions) {
			boolean shouldAdd = judgeAmount <= 3 || Boolean.TRUE.equals(slr.addToCollection());
			String rawLink = HtmlUtils.htmlUnescape(slr.subLink());

			if (shouldAdd && rawLink != null && !rawLink.isBlank()) {
				addToCollection(contestant, rawLink);
			}
		}
	}

	private boolean isSameSong(CollectionItem item, String subLink) {
		// This method checks if the title and artist of the collection item match the
		// title and artist of the submission link
		Submission sub = submissionService.getSubmissionBySubLink(subLink).orElse(null);
		if (sub == null || sub.getTitle() == null || sub.getArtist() == null) {
			return false;
		}

		return sub.getTitle().equalsIgnoreCase(item.getTitle()) && sub.getArtist().equalsIgnoreCase(item.getArtist());
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, String subLink) {
		String rawLink = HtmlUtils.htmlUnescape(subLink);

		CollectionItem newItem = new CollectionItem();
		newItem.setContestant(contestant);
		newItem.setSubLink(rawLink);
		// Leave artist/title blank until staff add them
		collectionItemRepository.save(newItem);
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, String subLink, String title, String artist) {
		String rawLink = HtmlUtils.htmlUnescape(subLink);

		CollectionItem newItem = new CollectionItem();
		newItem.setContestant(contestant);
		newItem.setSubLink(rawLink);
		newItem.setTitle(title);
		newItem.setArtist(artist);
		collectionItemRepository.save(newItem);
	}

	@Transactional(readOnly = true)
	public List<CollectionItem> getCollectionForUser(DiscordUser contestant) {
		return collectionItemRepository.findByContestantIdUser(contestant.getIdUser());
	}

	@Transactional
	public void syncCollectionItemData(DiscordUser contestant, String originalLink, String subLink, String title,
			String artist) {
		String rawLink = HtmlUtils.htmlUnescape(subLink);
		String rawOriginalLink = originalLink != null ? HtmlUtils.htmlUnescape(originalLink) : "";

		// Get all collection items that match the original link
		List<CollectionItem> copiesToUpdate = collectionItemRepository
			.findByContestantIdUserAndSubLink(contestant.getIdUser(), rawOriginalLink);

		// Update the subLink, title, and artist for all matching collection items
		for (CollectionItem item : copiesToUpdate) {
			item.setSubLink(rawLink);
			item.setTitle(title);
			item.setArtist(artist);
		}
	}

}
