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
      "name": "deposit",
      "docs": [
        "Deposit USDC, receive basket tokens priced by NAV (before this deposit)."
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
          "name": "basket",
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
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
          "name": "depositorUsdc",
          "writable": true
        },
        {
          "name": "depositorBasket",
          "writable": true
        },
        {
          "name": "vaultSol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [0].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultJup",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [1].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [USDC_INDEX].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "priceSol"
        },
        {
          "name": "priceJup"
        },
        {
          "name": "priceUsdc"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "usdcAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeBasket",
      "docs": [
        "Admin: create the basket PDA, the basket-token mint, and the 3 vault ATAs."
      ],
      "discriminator": [
        246,
        234,
        106,
        12,
        103,
        95,
        178,
        166
      ],
      "accounts": [
        {
          "name": "authority",
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "basketMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "solMint"
        },
        {
          "name": "jupMint"
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "vaultSol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "solMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultJup",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "jupMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
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
          "name": "weightsBps",
          "type": {
            "array": [
              "u16",
              3
            ]
          }
        },
        {
          "name": "feedIds",
          "type": {
            "array": [
              {
                "array": [
                  "u8",
                  32
                ]
              },
              3
            ]
          }
        },
        {
          "name": "rebalanceThresholdBps",
          "type": "u16"
        },
        {
          "name": "rebalanceIntervalSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "rebalance",
      "docs": [
        "Keeper-driven rebalance. Reads Pyth, checks drift >= threshold + interval,",
        "then mock-swaps each non-USDC asset to target against the keeper's reserve",
        "at the oracle price (0-slippage demo fill). Keeper == reserve owner."
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
        },
        {
          "name": "keeper",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultSol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [0].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultJup",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [1].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [USDC_INDEX].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "reserveSol",
          "writable": true
        },
        {
          "name": "reserveJup",
          "writable": true
        },
        {
          "name": "reserveUsdc",
          "writable": true
        },
        {
          "name": "priceSol"
        },
        {
          "name": "priceJup"
        },
        {
          "name": "priceUsdc"
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
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
          "name": "intervalSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "setPaused",
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
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
      "name": "withdraw",
      "docs": [
        "Withdraw: burn basket tokens, receive in-kind pro-rata of every asset.",
        "Oracle-free, swap-free, atomic — the un-gameable exit."
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
          "name": "basket",
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
                  116,
                  45,
                  118,
                  50
                ]
              }
            ]
          }
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
          "name": "vaultSol",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [0].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultJup",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [1].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "basket"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "basket.assets [USDC_INDEX].mint",
                "account": "basket"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userSol",
          "writable": true
        },
        {
          "name": "userJup",
          "writable": true
        },
        {
          "name": "userUsdc",
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
    }
  ],
  "events": [
    {
      "name": "basketInitialized",
      "discriminator": [
        16,
        54,
        84,
        252,
        60,
        150,
        211,
        136
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
      "name": "badWeights",
      "msg": "weights must sum to 10000 bps"
    },
    {
      "code": 6001,
      "name": "paused",
      "msg": "basket is paused"
    },
    {
      "code": 6002,
      "name": "zeroAmount",
      "msg": "amount must be > 0"
    },
    {
      "code": 6003,
      "name": "badAmount",
      "msg": "invalid amount"
    },
    {
      "code": 6004,
      "name": "zeroMint",
      "msg": "would mint zero basket tokens"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "math overflow"
    },
    {
      "code": 6006,
      "name": "stalePrice",
      "msg": "pyth price is stale"
    },
    {
      "code": 6007,
      "name": "badPrice",
      "msg": "pyth price invalid"
    },
    {
      "code": 6008,
      "name": "lowConfidence",
      "msg": "pyth price confidence too low"
    },
    {
      "code": 6009,
      "name": "emptyVault",
      "msg": "vault is empty"
    },
    {
      "code": 6010,
      "name": "intervalNotElapsed",
      "msg": "rebalance interval not elapsed"
    },
    {
      "code": 6011,
      "name": "driftBelowThreshold",
      "msg": "drift below threshold"
    },
    {
      "code": 6012,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6013,
      "name": "badPriceOwner",
      "msg": "price account not owned by pyth receiver"
    },
    {
      "code": 6014,
      "name": "feedMismatch",
      "msg": "price feed id mismatch"
    },
    {
      "code": 6015,
      "name": "badUsdcDecimals",
      "msg": "usdc asset must have 6 decimals"
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
            "name": "assets",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "assetConfig"
                  }
                },
                3
              ]
            }
          },
          {
            "name": "rebalanceThresholdBps",
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
      "name": "basketInitialized",
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
            "name": "usdcAmount",
            "type": "u64"
          },
          {
            "name": "minted",
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
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
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
