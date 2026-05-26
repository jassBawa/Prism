/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/mini_symmetry.json`.
 */
export type MiniSymmetry = {
  "address": "8TrJeQaHV4yXgPkNeZXR1pdWbEMXvnpLMYZpk1qX3jbe",
  "metadata": {
    "name": "miniSymmetry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createBasket",
      "docs": [
        "Create a basket from `num_assets` supported assets + target weights.",
        "`remaining_accounts`: for each asset i, the triple [mint_i, supported_i, vault_i]."
      ],
      "discriminator": [
        47,
        105,
        155,
        148,
        15,
        169,
        202,
        211
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "basket",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  115,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "id"
              }
            ]
          }
        },
        {
          "name": "basketMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "basket"
              }
            ]
          }
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": "u64"
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "website",
          "type": "string"
        },
        {
          "name": "twitter",
          "type": "string"
        },
        {
          "name": "telegram",
          "type": "string"
        },
        {
          "name": "discord",
          "type": "string"
        },
        {
          "name": "numAssets",
          "type": "u8"
        },
        {
          "name": "quoteIndex",
          "type": "u8"
        },
        {
          "name": "weightsBps",
          "type": {
            "vec": "u16"
          }
        },
        {
          "name": "rebalanceThresholdBps",
          "type": "u16"
        },
        {
          "name": "rebalanceThresholdRelBps",
          "type": "u16"
        },
        {
          "name": "rebalanceSpreadBps",
          "type": "u16"
        },
        {
          "name": "depositFeeBps",
          "type": "u16"
        },
        {
          "name": "rebalanceIntervalSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Deposit the quote asset; receive basket tokens priced by NAV (before this deposit).",
        "`remaining_accounts`: [vault_0..vault_{n-1}, price_0..price_{n-1}]."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "basket"
        },
        {
          "name": "basketMint",
          "writable": true
        },
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "depositorQuote",
          "writable": true
        },
        {
          "name": "depositorBasket",
          "writable": true
        },
        {
          "name": "creatorBasket",
          "docs": [
            "Creator's basket-token ATA — receives the deposit fee. Must already exist",
            "(clients pre-create it); bound to the creator via `basket.authority`."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "quoteAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initRegistry",
      "docs": [
        "Admin: create the basket registry (one-time). Lets clients/keeper enumerate",
        "baskets with getAccountInfo + getMultipleAccounts — no getProgramAccounts,",
        "which public/forked RPCs throttle or don't serve."
      ],
      "discriminator": [
        131,
        22,
        4,
        103,
        24,
        94,
        163,
        239
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ"
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "rebalance",
      "docs": [
        "Keeper-driven rebalance toward target weights via an oracle-priced mock swap",
        "against the keeper's own reserve. Per-asset best-effort: an asset whose",
        "reserve can't cover the delta is skipped, never reverting the whole tx.",
        "`remaining_accounts`: [vault_0.., price_0.., reserve_0..] (three n-blocks)."
      ],
      "discriminator": [
        108,
        158,
        77,
        9,
        210,
        52,
        88,
        62
      ],
      "accounts": [
        {
          "name": "basket",
          "writable": true
        },
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "setParams",
      "docs": [
        "Owner: set a basket's rebalance thresholds (abs + rel), interval, spread,",
        "and deposit fee."
      ],
      "discriminator": [
        27,
        234,
        178,
        52,
        147,
        2,
        187,
        141
      ],
      "accounts": [
        {
          "name": "basket",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "basket"
          ]
        }
      ],
      "args": [
        {
          "name": "thresholdBps",
          "type": "u16"
        },
        {
          "name": "thresholdRelBps",
          "type": "u16"
        },
        {
          "name": "intervalSecs",
          "type": "i64"
        },
        {
          "name": "spreadBps",
          "type": "u16"
        },
        {
          "name": "depositFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "setPaused",
      "docs": [
        "Owner: pause / unpause a basket (halts deposit + rebalance)."
      ],
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "basket",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "basket"
          ]
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setSupportedAsset",
      "docs": [
        "Admin: add or update a supported asset. Binds the mint to its Pyth feed",
        "and reads `decimals` from the real Mint (never trusts a caller arg)."
      ],
      "discriminator": [
        79,
        67,
        133,
        132,
        129,
        164,
        92,
        201
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "address": "Ea8PXNo7mjAp7TZKdPNZc4jhTngqzaJrkTY8sFKw7mqJ"
        },
        {
          "name": "mint"
        },
        {
          "name": "supportedAsset",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feedId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "isQuoteEligible",
          "type": "bool"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.",
        "Oracle-free, swap-free, atomic — the un-gameable exit.",
        "`remaining_accounts`: [vault_0..vault_{n-1}, user_ata_0..user_ata_{n-1}]."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "basket"
        },
        {
          "name": "basketMint",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "userBasket",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "basketAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "basket",
      "discriminator": [
        219,
        79,
        107,
        135,
        231,
        243,
        218,
        248
      ]
    },
    {
      "name": "registry",
      "discriminator": [
        47,
        174,
        110,
        246,
        184,
        182,
        252,
        218
      ]
    },
    {
      "name": "supportedAsset",
      "discriminator": [
        129,
        27,
        96,
        192,
        89,
        180,
        227,
        200
      ]
    }
  ],
  "events": [
    {
      "name": "basketCreated",
      "discriminator": [
        26,
        146,
        108,
        155,
        189,
        85,
        8,
        7
      ]
    },
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "rebalanced",
      "discriminator": [
        74,
        101,
        57,
        244,
        181,
        179,
        52,
        182
      ]
    },
    {
      "name": "supportedAssetSet",
      "discriminator": [
        53,
        98,
        118,
        75,
        253,
        110,
        99,
        229
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "badAssetCount",
      "msg": "asset count must be between 2 and 4"
    },
    {
      "code": 6001,
      "name": "badWeights",
      "msg": "weights must sum to 10000 bps and match asset count"
    },
    {
      "code": 6002,
      "name": "badQuoteIndex",
      "msg": "quote index out of range"
    },
    {
      "code": 6003,
      "name": "badParams",
      "msg": "threshold/interval below minimum"
    },
    {
      "code": 6004,
      "name": "badMetadata",
      "msg": "name must be 1..=32 chars and description <= 200"
    },
    {
      "code": 6005,
      "name": "badRemainingAccounts",
      "msg": "wrong number of remaining accounts"
    },
    {
      "code": 6006,
      "name": "duplicateAsset",
      "msg": "duplicate asset in basket"
    },
    {
      "code": 6007,
      "name": "badMint",
      "msg": "invalid SPL mint"
    },
    {
      "code": 6008,
      "name": "assetNotSupported",
      "msg": "asset not in the supported allowlist"
    },
    {
      "code": 6009,
      "name": "quoteNotEligible",
      "msg": "quote asset is not quote-eligible"
    },
    {
      "code": 6010,
      "name": "paused",
      "msg": "basket is paused"
    },
    {
      "code": 6011,
      "name": "zeroAmount",
      "msg": "amount must be > 0"
    },
    {
      "code": 6012,
      "name": "badAmount",
      "msg": "invalid amount"
    },
    {
      "code": 6013,
      "name": "zeroMint",
      "msg": "would mint zero basket tokens"
    },
    {
      "code": 6014,
      "name": "dustWithdraw",
      "msg": "withdraw rounds to zero — increase amount"
    },
    {
      "code": 6015,
      "name": "mathOverflow",
      "msg": "math overflow"
    },
    {
      "code": 6016,
      "name": "stalePrice",
      "msg": "pyth price is stale"
    },
    {
      "code": 6017,
      "name": "badPrice",
      "msg": "pyth price invalid"
    },
    {
      "code": 6018,
      "name": "lowConfidence",
      "msg": "pyth price confidence too low"
    },
    {
      "code": 6019,
      "name": "emptyVault",
      "msg": "vault is empty"
    },
    {
      "code": 6020,
      "name": "intervalNotElapsed",
      "msg": "rebalance interval not elapsed"
    },
    {
      "code": 6021,
      "name": "driftBelowThreshold",
      "msg": "drift below threshold"
    },
    {
      "code": 6022,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6023,
      "name": "badPriceOwner",
      "msg": "price account not owned by pyth receiver"
    },
    {
      "code": 6024,
      "name": "feedMismatch",
      "msg": "price feed id mismatch"
    },
    {
      "code": 6025,
      "name": "badVault",
      "msg": "invalid vault account"
    },
    {
      "code": 6026,
      "name": "badUserAccount",
      "msg": "invalid user/reserve token account"
    },
    {
      "code": 6027,
      "name": "duplicatePrice",
      "msg": "duplicate price account"
    },
    {
      "code": 6028,
      "name": "registryFull",
      "msg": "basket registry is full"
    }
  ],
  "types": [
    {
      "name": "assetConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "targetWeightBps",
            "type": "u16"
          },
          {
            "name": "feedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "decimals",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "basket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "basketMint",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "website",
            "type": "string"
          },
          {
            "name": "twitter",
            "type": "string"
          },
          {
            "name": "telegram",
            "type": "string"
          },
          {
            "name": "discord",
            "type": "string"
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "numAssets",
            "type": "u8"
          },
          {
            "name": "quoteIndex",
            "type": "u8"
          },
          {
            "name": "assets",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "assetConfig"
                  }
                },
                8
              ]
            }
          },
          {
            "name": "rebalanceThresholdBps",
            "type": "u16"
          },
          {
            "name": "rebalanceThresholdRelBps",
            "type": "u16"
          },
          {
            "name": "rebalanceSpreadBps",
            "type": "u16"
          },
          {
            "name": "depositFeeBps",
            "type": "u16"
          },
          {
            "name": "rebalanceIntervalSecs",
            "type": "i64"
          },
          {
            "name": "lastRebalanceTs",
            "type": "i64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "basketCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "basket",
            "type": "pubkey"
          },
          {
            "name": "basketMint",
            "type": "pubkey"
          },
          {
            "name": "numAssets",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "basket",
            "type": "pubkey"
          },
          {
            "name": "quoteAmount",
            "type": "u64"
          },
          {
            "name": "minted",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "navBefore",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rebalanced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "keeper",
            "type": "pubkey"
          },
          {
            "name": "basket",
            "type": "pubkey"
          },
          {
            "name": "maxDriftBps",
            "type": "u16"
          },
          {
            "name": "nav",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "registry",
      "docs": [
        "On-chain index of every basket pubkey — read with getAccountInfo +",
        "getMultipleAccounts instead of getProgramAccounts. Zero-copy: the ~8 KB array",
        "must be accessed in place, never deserialized onto the BPF stack."
      ],
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "count",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "pad",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "baskets",
            "type": {
              "array": [
                "pubkey",
                256
              ]
            }
          }
        ]
      }
    },
    {
      "name": "supportedAsset",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "feedId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "isQuoteEligible",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "supportedAssetSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "isQuoteEligible",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "basket",
            "type": "pubkey"
          },
          {
            "name": "burned",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
