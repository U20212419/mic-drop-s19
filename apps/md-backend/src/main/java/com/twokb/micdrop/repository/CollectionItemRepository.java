package com.twokb.micdrop.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.twokb.micdrop.model.CollectionItem;

public interface CollectionItemRepository extends JpaRepository<CollectionItem, Integer> {

	List<CollectionItem> findByContestantIdUserAndSubLink(Integer idContestant, String subLink);

	List<CollectionItem> findByContestantIdUser(Integer idContestant);

}
