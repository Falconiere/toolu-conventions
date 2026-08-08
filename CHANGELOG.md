# [0.6.0](https://github.com/Falconiere/toolu-conventions/compare/v0.5.0...v0.6.0) (2026-08-08)


### Bug Fixes

* close dead-code enforcement bypasses ([4c20e6b](https://github.com/Falconiere/toolu-conventions/commit/4c20e6b8e9acc0e4b2750b526fdecdb70bab3e2d))
* **guardrails:** close remaining suppression escapes ([5982117](https://github.com/Falconiere/toolu-conventions/commit/5982117284f9b881a6a1d0e3bd41315d64e95824))
* **guardrails:** disambiguate TypeScript syntax ([82591c0](https://github.com/Falconiere/toolu-conventions/commit/82591c0efcffff5a6c3661cbbd24837917d3ce07))
* **guardrails:** distinguish statement keyword context ([ddec0c2](https://github.com/Falconiere/toolu-conventions/commit/ddec0c2a81175a9c831546c874a3d2b11c3c66fe))
* **guardrails:** fail closed on parser edge cases ([1e7caed](https://github.com/Falconiere/toolu-conventions/commit/1e7caed2748561bed1de64ed0637614a9d75f82b))
* **guardrails:** parse suppression syntax accurately ([f8e0d4f](https://github.com/Falconiere/toolu-conventions/commit/f8e0d4f96035d95ecb8e0dab2a4bf331aeacf0b9))
* **guardrails:** preserve lexical context across trivia ([3d33ab5](https://github.com/Falconiere/toolu-conventions/commit/3d33ab5fe1a31ba63514eca7deb7b9f09cec15e3))
* **guardrails:** preserve TSX expression context ([d9308b8](https://github.com/Falconiere/toolu-conventions/commit/d9308b88064d2c348075b285ccc04d3c6f7cca3a))
* **guardrails:** recognize private member boundaries ([f1c46a8](https://github.com/Falconiere/toolu-conventions/commit/f1c46a8b96e52b8337272350615ec0efc0652df7))


### Features

* **guardrails:** reject dead-code suppressions ([3f0904f](https://github.com/Falconiere/toolu-conventions/commit/3f0904f0a6c063329507ba5de81600c00eccbd72))
* **rust:** deny dead code ([cf2508e](https://github.com/Falconiere/toolu-conventions/commit/cf2508e5ba6fdb97e7433073660024ab2c79d98f))
* **typescript:** reject all unused code ([09293d2](https://github.com/Falconiere/toolu-conventions/commit/09293d2560eecbea8829fe729eb89b1cf0da173b))


### Performance Improvements

* **guardrails:** keep suppression hooks within budget ([01b0432](https://github.com/Falconiere/toolu-conventions/commit/01b04324c3f237e0d19a83c09608ba1353ba824a))

# [0.5.0](https://github.com/Falconiere/toolu-conventions/compare/v0.4.0...v0.5.0) (2026-08-07)


### Bug Fixes

* address operations review findings ([c18d5cd](https://github.com/Falconiere/toolu-conventions/commit/c18d5cd1e019b8d1ee50835aabf2c58074bcae05))
* enforce operations manifest boundaries ([5907f91](https://github.com/Falconiere/toolu-conventions/commit/5907f91e4fd5345551895776603d9d8210f80a91))
* harden secret staging and service startup ([7213180](https://github.com/Falconiere/toolu-conventions/commit/7213180a363656ef7f0df16cfb0e035d3892d1a2))
* harden tunnel token handoff ([0128ee7](https://github.com/Falconiere/toolu-conventions/commit/0128ee79e1f4f5344bf98677bc335da02e622d93))
* keep tunnel failures scoped ([eca0ffa](https://github.com/Falconiere/toolu-conventions/commit/eca0ffa9797474838b2182c15e7cfe3499765e3f))
* verify local supervisor ownership ([63ba292](https://github.com/Falconiere/toolu-conventions/commit/63ba292b8a10bd3021dce29e74cef336d86d1049))


### Features

* add operations conventions and skills ([180edb7](https://github.com/Falconiere/toolu-conventions/commit/180edb760abf7657e0ec4b0171a9b7a9a6cd2c48))

# [0.4.0](https://github.com/Falconiere/toolu-conventions/compare/v0.3.0...v0.4.0) (2026-08-07)


### Bug Fixes

* **release:** drop App-id probe that needs a JWT ([55b3465](https://github.com/Falconiere/toolu-conventions/commit/55b34655b8b08fa24ba9901263fe5c630404c596))
* **release:** no GITHUB_TOKEN fallback on push checkout ([026b050](https://github.com/Falconiere/toolu-conventions/commit/026b050a148a30f1ebf2b56c3f4ff00e3e5941a1))
* **release:** push changelog as all-app-release App ([e9f06ea](https://github.com/Falconiere/toolu-conventions/commit/e9f06ead7d0afd1122f834910f3487e1d3fb7775))
* **release:** sync bun.lock and invoke semantic-release via node ([4ec67cb](https://github.com/Falconiere/toolu-conventions/commit/4ec67cb9266b06733bae77bd1619a39465a85721))


### Features

* **release:** cut tags and CHANGELOG on merge to main ([377c718](https://github.com/Falconiere/toolu-conventions/commit/377c7186513e1299994b4ad34da008d92be8a68b))

# Changelog

Release notes are written here automatically by
[semantic-release](https://semantic-release.gitbook.io/) when a releasable
commit lands on `main`. Pre-automation history lives in the version blockquotes
at the bottom of [`README.md`](./README.md).
