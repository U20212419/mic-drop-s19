package com.twokb.micdrop.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
			.map(s -> s.subLink())
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

			if (shouldAdd && slr.subLink() != null && !slr.subLink().isBlank()) {
				addToCollection(contestant, slr.subLink());
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
		CollectionItem newItem = new CollectionItem();
		newItem.setContestant(contestant);
		newItem.setSubLink(subLink);
		// Leave artist/title blank until staff add them
		collectionItemRepository.save(newItem);
	}

	@Transactional
	public void addToCollection(DiscordUser contestant, String subLink, String title, String artist) {
		CollectionItem newItem = new CollectionItem();
		newItem.setContestant(contestant);
		newItem.setSubLink(subLink);
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
		// Scenario 1: The original link is null or blank, but the new link is not
		if (originalLink == null || originalLink.isBlank()) {
			if (subLink != null && !subLink.isBlank()) {
				addToCollection(contestant, subLink, title, artist);
			}
			return;
		}

		// Get all collection items that match the original link
		List<CollectionItem> copiesToUpdate = collectionItemRepository
			.findByContestantIdUserAndSubLink(contestant.getIdUser(), originalLink);

		if (copiesToUpdate.isEmpty()) {
			return;
		}

		// Scenario 2: A staff member removed the link from a submission
		if (subLink == null || subLink.isBlank()) {
			// Only delete one copy to avoid removing copies from previous submissions of
			// the same song
			collectionItemRepository.delete(copiesToUpdate.get(0));
			return;
		}

		// Scenario 3: A staff member updated the link, title, or artist of a submission
		if (!originalLink.equals(subLink)) {
			// The link has changed, so we update only one copy in the user's inventory.
			// If we update all copies that share the old link, and the new link happens
			// to belong to a completely
			// different song that they already own, those two distinct songs will
			// permanently merge into one identity in the database.
			// By updating just one, we safely change this specific submission's copy
			// without affecting the rest of their collection.
			CollectionItem itemToUpdate = copiesToUpdate.get(0);
			itemToUpdate.setSubLink(subLink);
			itemToUpdate.setTitle(title);
			itemToUpdate.setArtist(artist);
		}
		else {
			// The link is exactly the same, so we can safely update all copies that share
			// this link with the new title and artist.
			for (CollectionItem item : copiesToUpdate) {
				item.setTitle(title);
				item.setArtist(artist);
			}
		}
	}

	@Transactional(readOnly = true)
	public long countCopiesOwned(DiscordUser contestant, String subLink) {
		return collectionItemRepository.countByContestantAndSubLink(contestant, subLink);
	}

	@Transactional(readOnly = true)
	public List<CollectionItem> findByContestantAndSubLink(DiscordUser contestant, String subLink) {
		return collectionItemRepository.findByContestantIdUserAndSubLink(contestant.getIdUser(), subLink);
	}

}
