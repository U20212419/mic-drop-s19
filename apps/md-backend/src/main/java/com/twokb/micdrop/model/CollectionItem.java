package com.twokb.micdrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "collection_item")
@Data
@NoArgsConstructor
public class CollectionItem {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_collection")
	private Integer idCollection;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "id_contestant", nullable = false)
	private DiscordUser contestant;

	@Column(name = "sub_link", nullable = false)
	private String subLink;

	@Column(name = "title")
	private String title;

	@Column(name = "artist")
	private String artist;

	@Column(name = "quantity", nullable = false)
	private Integer quantity = 0;

}
