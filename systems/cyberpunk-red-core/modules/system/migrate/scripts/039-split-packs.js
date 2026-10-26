import BaseMigrationScript from "../base-migration-script.js";
import CPRSystemUtils from "../../../utils/cpr-systemUtils.js";

// Map of the image moves, old: new
export const IMG_MAP = {
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/osmosis_compound.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/osmosis_compound.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/arasaka-fire.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/arasaka-fire.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/arasaka-wound-salt.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/arasaka-wound-salt.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/paintball_tracking.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/paintball_tracking.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/grenade_tied.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/grenade_tied.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/capsule_tied.png":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/capsule_tied.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/rocks.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/ammo/rocks.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/corporate-island.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/corporate-island.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/dirk-combat-jacket.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/dirk-combat-jacket.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/executive-armor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/executive-armor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/bunker-gear.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/bunker-gear.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/laser-light-street-jacket.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/laser-light-street-jacket.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/lotus-netsuit.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/lotus-netsuit.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/masetto-airrider.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/masetto-airrider.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/mechaman-helmet.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/mechaman-helmet.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/mimic-clothing-kit.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/mimic-clothing-kit.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/variable-clothing-line.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/variable-clothing-line.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/shock-armor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/shock-armor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/skidrow-trench.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/skidrow-trench.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/street-viper-riding-suit.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/street-viper-riding-suit.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/smart-armor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/armor/smart-armor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/holo-wear.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/clothing/holo-wear.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/cyberfinger.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/cyberfinger.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/budget-chipware-socket.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/budget-chipware-socket.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/modular-hand.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/modular-hand.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/explicit-memory-stimulator.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/explicit-memory-stimulator.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/extra-joined-cyberarm.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/extra-joined-cyberarm.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/extra-joined-cyberleg.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/extra-joined-cyberleg.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/flash-bulb.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/flash-bulb.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/heuristic-health-monitor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/heuristic-health-monitor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/neo-soviet-cyberarm.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/neo-soviet-cyberarm.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/popup-net.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/popup-net.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/popup-shotgun.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/popup-shotgun.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/racer-bracer.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/racer-bracer.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/reflex-co-processor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/reflex-co-processor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/reinforced-cyberarm.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/reinforced-cyberarm.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/reinforced-cyberleg.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/reinforced-cyberleg.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/mechaman-smartglove.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/cyberware/mechaman-smartglove.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/chipvault.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/chipvault.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/co2-tank.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/co2-tank.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/drink-master-3000.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/drink-master-3000.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/airwell.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/airwell.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/one-touch-habitat.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/one-touch-habitat.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/jeeves-garment-bag.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/jeeves-garment-bag.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/killstrom-banshee-microphone.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/killstrom-banshee-microphone.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/killstrom-sonic-boom-amp.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/killstrom-sonic-boom-amp.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/killstrom-typhoid-speaker.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/killstrom-typhoid-speaker.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/ktech-doberman-500.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/ktech-doberman-500.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/laser-light-electric-guitar.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/laser-light-electric-guitar.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/mr-biscuit-multi-food-processor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/mr-biscuit-multi-food-processor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/nitro-ultra9.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/nitro-ultra9.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/rapideploy-sheath.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/rapideploy-sheath.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/shower-in-can.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/shower-in-can.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/sovoil-lubricant.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/sovoil-lubricant.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/streetcase.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/streetcase.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/triti-fizz.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/triti-fizz.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/worldsat-aerial-sphere.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/worldsat-aerial-sphere.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zetatech-porta-printer.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/gear/zetatech-porta-printer.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/4tify.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/upgrades/4tify.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/digital-gladiator.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/upgrades/digital-gladiator.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/ncpd-crime-database.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/upgrades/ncpd-crime-database.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/trauma-team-medscan.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/upgrades/trauma-team-medscan.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/ziggurat-city-database.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/upgrades/ziggurat-city-database.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/econocompact.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/econocompact.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/family-star-van.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/family-star-van.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/dayton-tdt-004.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/dayton-tdt-004.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/chupacabra.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/chupacabra.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/range-trike.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/range-trike.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/grundy.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/grundy.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/harriet.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/harriet.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/harvey.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/harvey.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/harvey-merc.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/harvey-merc.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/artemis.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/artemis.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/volkhov.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/volkhov.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/makagai-ebi.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/makagai-ebi.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/gorgon-security-van.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/gorgon-security-van.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/paladin-500.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/paladin-500.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/thunder-x.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/thunder-x.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/sh-45-patroller.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/sh-45-patroller.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/street-king.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/street-king.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/tanson-bellhop.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/tanson-bellhop.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/jetboy-hoverboard.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/jetboy-hoverboard.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/badger-corporate-bus.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/badger-corporate-bus.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/megahauler.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/megahauler.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/yangs-wheels-rickshaw.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/yangs-wheels-rickshaw.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zacatzontil.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zacatzontil.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zetatech-aerocop.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zetatech-aerocop.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zetatech-aerovox.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zetatech-aerovox.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zetatech-destination.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zetatech-destination.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zetatech-herakles.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zetatech-herakles.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zonda-molly.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zonda-molly.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zonda-parallax.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zonda-parallax.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zonda-sliver.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/vehicles/zonda-sliver.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/faisals-magna-knuckles.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/faisals-magna-knuckles.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/door-cracker.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/door-cracker.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/kenadachi-mono-guard.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/kenadachi-mono-guard.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/mono-star.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/mono-star.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/killchip-100-micro-bomb.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/killchip-100-micro-bomb.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/micro-hydrogen-combustor.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/micro-hydrogen-combustor.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/outlet-explosive.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/outlet-explosive.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/pursuit-security-bouncer.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/pursuit-security-bouncer.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/ranger-combat-boomerang.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/ranger-combat-boomerang.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/rostovic-kleaver.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/rostovic-kleaver.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/fangfist.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/fangfist.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/tr-4-detonator-fluid.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/tr-4-detonator-fluid.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/utility-tomahawk.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/utility-tomahawk.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome/zhirafa-rhinocefist.svg":
    "modules/cyberpunk-red-dlc/icons/black-chrome/weapons/zhirafa-rhinocefist.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/bow_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/bow_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolheavy_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolheavy_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolheavy_small.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolmedium_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolmedium_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolmedium_small.png",
  "systems/cyberpunk-red-core/icons/compendium/woodchippers_garage/paintball_biotoxin.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_biotoxin.png",
  "systems/cyberpunk-red-core/icons/compendium/woodchippers_garage/paintball_poison.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/paintball_poison.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/rifle_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/rifle_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/rifle_small.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/shotgun_slug_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/shotgun_slug_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolveryheavy_junk.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_junk.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/pistolveryheavy_small.png":
    "modules/cyberpunk-red-dlc/icons/dlc/ammo/pistolveryheavy_small.png",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/molotov-cocktail.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/weapons/molotov-cocktail.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/esporma_enviroment_suit.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/armor/esporma_enviroment_suit.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/sycust_fleshweave.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/armor/sycust_fleshweave.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/skidrow_packshield.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/armor/skidrow_packshield.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/scavenged-armor.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/armor/scavenged-armor.svg",
  "modules/cyberpunk-red-dlc/icons/compendium/dlc/drugs/drink_icon.svg":
    "systems/cyberpunk-red-core/icons/compendium/default/default_drink.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/berserker.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/berserker.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/piranha-smash.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/piranha-smash.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/prime_time.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/prime_time.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/sedative.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/sedative.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/sixgun.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/sixgun.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/timewarp.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/timewarp.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/veritas.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/drugs/veritas.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/appetite_controller.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/appetite_controller.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/radline_blitzkrieg-arc-thrower_cyberarm.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/radline_blitzkrieg-arc-thrower_cyberarm.svg",
  "systems/cyberpunk-red-core/icons/compendium/micro_chrome/chipware_compartment.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/chipware_compartment.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/combat-jaw.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/combat-jaw.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/combat-tail.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/combat-tail.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/cyberpillow.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/cyberpillow.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/deathtrance.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/deathtrance.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/external_vidscreen.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/external_vidscreen.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/extra-joined-cyberarm.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/extra-joined-cyberarm.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/extra-joined-cyberleg.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/extra-joined-cyberleg.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/firebreather.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/firebreather.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/cybermatrix_gang_jazzler.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/cybermatrix_gang_jazzler.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/heuristic-health-monitor.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/heuristic-health-monitor.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/holo_projector_palm.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/holo_projector_palm.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/kill_display.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/kill_display.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/leads_turn_on_show_off_nails.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/leads_turn_on_show_off_nails.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/raven_microcybernetics_microwaldo.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/raven_microcybernetics_microwaldo.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/kiroshi_monovision.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/kiroshi_monovision.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/mood_eye.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/mood_eye.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/kiroshi_optishield.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/kiroshi_optishield.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/perfectfit_cyberfoot.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/perfectfit_cyberfoot.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/personalpak_kibble_warmer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/personalpak_kibble_warmer.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/poser_chip.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/poser_chip.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/pursuit_security_inc_personal_shredder.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/pursuit_security_inc_personal_shredder.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/reflex-co-processor.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/reflex-co-processor.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/wyzard-technologies_romanova-cyberlegs.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/wyzard-technologies_romanova-cyberlegs.svg",
  "systems/cyberpunk-red-core/icons/compendium/micro_chrome/smart_lens.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/smart_lens.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_cybermas/psiberstuff_watch-man.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/psiberstuff_watch-man.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/dynalar_xtra-dex_smart_glove.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/dynalar_xtra-dex_smart_glove.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/cyberscanner_cyberware.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/cyberscanner_cyberware.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/furniture-set.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/furniture-set.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/bullet-to-slug-adapter-casings.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/bullet-to-slug-adapter-casings.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/raven_microcybernetics_cybercam_ex-1.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/raven_microcybernetics_cybercam_ex-1.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/cyberscanner_gear.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/cyberscanner_gear.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/delaying_compound.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/delaying_compound.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/distilling_compound.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/distilling_compound.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/fire-safe.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/fire-safe.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/graf3.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/graf3.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/hidden-compartment.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/hidden-compartment.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/inline_skates.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/inline_skates.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/ion_cuffs.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/ion_cuffs.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/koff-popper.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/koff-popper.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/koff-pops.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/koff-pops.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/optitech_magviewer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/optitech_magviewer.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/master_mechanics_tool_kit.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/master_mechanics_tool_kit.svg",
  "systems/cyberpunk-red-core/icons/compendium/cyberchairs/cyberchair.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/cyberchair.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/telectronics_minimag_speakers.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/telectronics_minimag_speakers.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/my-first-graf3.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/my-first-graf3.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/savannah-eagle.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/savannah-eagle.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/savannah-panther.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/savannah-panther.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/skateboard.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/skateboard.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/smart-vanity.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/smart-vanity.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/dpi_smartsticks.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/dpi_smartsticks.svg",
  "systems/cyberpunk-red-core/icons/compendium/black-chrome-plus/solo-of-fortune-body-pillow.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/solo-of-fortune-body-pillow.svg",
  "systems/cyberpunk-red-core/icons/compendium/hornets_pharmacy/suzumebachi_assassin_drone.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/suzumebachi_assassin_drone.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/the-observer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/the-observer.svg",
  "systems/cyberpunk-red-core/icons/compendium/all-about-drones/the-transporter.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/the-transporter.svg",
  "systems/cyberpunk-red-core/icons/compendium/night-city-weather/umbrella.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/umbrella.svg",
  "systems/cyberpunk-red-core/icons/compendium/cargo-containers-and-cube-hotels/wall-art.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/wall-art.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/aerie.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/aerie.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/bottle_dynamo.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/bottle_dynamo.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/bushido_accelerator.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/bushido_accelerator.svg",
  "systems/cyberpunk-red-core/icons/compendium/night-city-weather/cold-weather-jacket-lining.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/cold-weather-jacket-lining.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/combat_recorder.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/combat_recorder.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/cycle_armor.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/cycle_armor.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/defense_sequencer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/defense_sequencer.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/electric_pedal_assist.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/electric_pedal_assist.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/enclosure.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/enclosure.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/extended_seat.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/extended_seat.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/feline_instinct.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/feline_instinct.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/folding_frame.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/folding_frame.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/hangry_hnagry_dragon.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/hangry_hnagry_dragon.svg",
  "systems/cyberpunk-red-core/icons/compendium/night-city-weather/hot-weather-jacket-lining.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/hot-weather-jacket-lining.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/neon_lighting.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/neon_lighting.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/perfume_shoppe.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/perfume_shoppe.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/reinforced_frame.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/reinforced_frame.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/security_system.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/security_system.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/smithy.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/smithy.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/snaketrap.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/snaketrap.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/swamp_mist.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/swamp_mist.svg",
  "systems/cyberpunk-red-core/icons/compendium/midnight-with-the-upload/swifty_clean.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/swifty_clean.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/trailer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/trailer.svg",
  "systems/cyberpunk-red-core/icons/compendium/night-city-weather/waterproof-jacket-lining.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/upgrades/waterproof-jacket-lining.svg",
  "systems/cyberpunk-red-core/icons/compendium/spinning_your_wheels/bicycle.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/vehicles/bicycle.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/zonda_metrocar.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/vehicles/zonda_metrocar.svg",
  "systems/cyberpunk-red-core/icons/compendium/night-city-weather/tactical-umbrella.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/weapons/tactical-umbrella.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/appetite_controller.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/appetite_controller.svg",
  "systems/cyberpunk-red-core/icons/compendium/exotics-of-2045/neutongue.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/neutongue.svg",
  "systems/cyberpunk-red-core/icons/compendium/must_have_cyberware_deals/neutongue.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/cyberware/neutongue.svg",
  "systems/cyberpunk-red-core/icons/compendium/the_12_days_of_gearmas/green_light_go_sniffer.svg":
    "modules/cyberpunk-red-dlc/icons/dlc/gear/green_light_go_sniffer.svg",
};

const PACK_MAP = {
  wIMBD44ZU3iJ6jNI: "black-chrome_ammo",
  "9diHOp9hSafmHRqC": "black-chrome_ammo",
  LumJXCKgGQTLZJWu: "black-chrome_ammo",
  "2h87i3r9DkK7sabX": "black-chrome_ammo",
  "80TODp6SDXS3ZnSi": "black-chrome_ammo",
  EBdbf1JaVGl0M7LJ: "black-chrome_ammo",
  KPSBX2Ns6cj6JC4v: "black-chrome_ammo",
  etGQrEprF1AboZmt: "black-chrome_ammo",
  ZsltnSIORaBm5bh6: "black-chrome_ammo",
  iaDD8BqMah0gQAkE: "black-chrome_armor",
  O455ilkzLFqzgtYE: "black-chrome_armor",
  "7Ki9v2iwMH8AZp8B": "black-chrome_armor",
  nTasr1dMu9uE62BS: "black-chrome_armor",
  fyi3U9v6On4r1iiO: "black-chrome_armor",
  "1oD47YLHJqb4V8aj": "black-chrome_armor",
  D4kiUBYevT8JBVz2: "black-chrome_armor",
  r3uE9rEiOK1PQ9kr: "black-chrome_armor",
  "841gdYzNXXpnSXJy": "black-chrome_armor",
  B5ZeRQkidYDBAP9w: "black-chrome_armor",
  XDMhclpr1Elz9CFY: "black-chrome_armor",
  Zl2vI7SNhP0jFhkl: "black-chrome_armor",
  h59j4espzFR3tlY2: "black-chrome_armor",
  rUlYYcKLBrenj0wb: "black-chrome_armor",
  RhnvvJ4iS6D88Scz: "black-chrome_armor",
  LC58KTHAuFDzIFRq: "black-chrome_armor",
  Zp4KJsajg98V6NOv: "black-chrome_armor",
  nD8jihkwmgT8sVqD: "black-chrome_armor",
  ETPujR8m7tEoYFQW: "black-chrome_armor",
  "592mTHSG05w0qS0W": "black-chrome_armor",
  xVE36X9aE4m3mRza: "black-chrome_armor",
  OzfbjQ3nPCCf6BQQ: "black-chrome_armor",
  "5TCY5tMvyCOuzB6l": "black-chrome_armor",
  Ik8mQIo1XkBrPmN4: "black-chrome_clothing",
  AV1y4kaMRtHsVc0D: "black-chrome_cyberware",
  Eajel3kkoOKaczer: "black-chrome_cyberware",
  k3up6yJN3q19RqOj: "black-chrome_cyberware",
  ag2NOC3S5eOUqQRT: "black-chrome_cyberware",
  Vvi8yU2On6338ALX: "black-chrome_cyberware",
  ossVBGJKxdq6aEn2: "black-chrome_cyberware",
  k9wdC3XNapYdQq4m: "black-chrome_cyberware",
  VSw96UuPdlXfu7Hy: "black-chrome_cyberware",
  iQMwC5XITZSDn4mz: "black-chrome_cyberware",
  NfrakevKusMULu6P: "black-chrome_cyberware",
  aGxQy3sWYa5M9bLd: "black-chrome_cyberware",
  QQcjD2PAqtd0qxY4: "black-chrome_cyberware",
  v4xCXdzyP3RrPKac: "black-chrome_cyberware",
  "8KE75GWYioRWNlfU": "black-chrome_cyberware",
  w1g8ZF7tOuo2gLfr: "black-chrome_cyberware",
  LN4eu5DJcmX18K16: "black-chrome_cyberware",
  sKD3i5CPsJLJPzIt: "black-chrome_cyberware",
  nH3p5XdyArI2faqK: "black-chrome_cyberware",
  R3b9aNqHxWIAo4tX: "black-chrome_cyberware",
  vuq1KEbsMjpOTqhl: "black-chrome_cyberware",
  "6PfH7lBjCD2wEZ6M": "black-chrome_cyberware",
  uOZRE7aMyIIj0f6j: "black-chrome_cyberware",
  fh46Z1LU3u4gJQLP: "black-chrome_cyberware",
  Rk3bTGf7Vqdf53Yl: "black-chrome_cyberware",
  LY8v30DQnkuCOpIu: "black-chrome_cyberware",
  syuke8XbziKsSzbV: "black-chrome_cyberware",
  f9u0uhwRBcunP0gz: "black-chrome_cyberware",
  MfNQoF64u5w8cK7A: "black-chrome_cyberware",
  hqxjHYkBe9mLzl2B: "black-chrome_cyberware",
  oYcEZ8R8qVoalhyI: "black-chrome_cyberware",
  A8TUvYw4Ysv7tqpL: "black-chrome_cyberware",
  gR3ICJgM9CtZnGlr: "black-chrome_cyberware",
  "0z0v50kDAgHvMquv": "black-chrome_cyberware",
  RA7Fa2ZiPNiJ1pQx: "black-chrome_cyberware",
  XFC4oT7IIWlWDnCI: "black-chrome_cyberware",
  BYDAED1axkFYm1h9: "black-chrome_cyberware",
  LvFvoVzl06GzOVi0: "black-chrome_cyberware",
  "1I3XvXjC2cYqCTzn": "black-chrome_cyberware",
  "6n9UMTK8mY6yDFB2": "black-chrome_cyberware",
  Kv5ZtZPYDeTUBv06: "black-chrome_cyberware",
  GkcLdOzI3jhtTYPd: "black-chrome_cyberware",
  nr9onGjdx3SMLB64: "black-chrome_gear",
  "2LaYl7hRn5V8cGUd": "black-chrome_gear",
  wSx9q7TVUJevCu8w: "black-chrome_gear",
  DQ22OUTZiHGj8vWD: "black-chrome_gear",
  yK1OjwJXiEvjPnS5: "black-chrome_gear",
  Ogmb7zTfss6Kz54C: "black-chrome_gear",
  swKwgrj4QbNn5EvW: "black-chrome_gear",
  DYn19Vh2BVkg7FSW: "black-chrome_gear",
  THuhq91qOtXUZCrf: "black-chrome_gear",
  jD1vibznO6KMHfJR: "black-chrome_gear",
  seglg544pSg95OjB: "black-chrome_gear",
  NoN4GJNgu6tE6mqd: "black-chrome_gear",
  qVrAYOVvfBpIgEor: "black-chrome_gear",
  dvM7wdQgkRevCiqE: "black-chrome_gear",
  GMouAyDuNb6QJ4a4: "black-chrome_gear",
  DZe6EtplLToNFWjN: "black-chrome_gear",
  Hpa8rpiVDRX29Gr5: "black-chrome_gear",
  oMgMhUUI35PyKJ50: "black-chrome_gear",
  G7KBZHlRtEBGD6JY: "black-chrome_gear",
  hKYCFn6oovt6pBwF: "black-chrome_gear",
  "4tW3lY40iTSHukUL": "black-chrome_gear",
  RpCYrr6aUyZDUr4v: "black-chrome_gear",
  U47JzJJylGt7DGaB: "black-chrome_gear",
  pcQ6FsBuHHIWNDlP: "black-chrome_gear",
  "8gcusVGx52IgAZdX": "black-chrome_gear",
  QE785D3EE383knl6: "black-chrome_gear",
  lZYITSx53rsxoNHz: "black-chrome_gear",
  W9F58ETpCL2o1XYu: "black-chrome_gear",
  uutOVoS9B6zf2zMt: "black-chrome_upgrades",
  pgR21oLCYDNw8tuP: "black-chrome_upgrades",
  DhaKI1zPnwgCunov: "black-chrome_upgrades",
  xatc5UtvmspX6JJh: "black-chrome_upgrades",
  BEEWtOZvjXxgHvd2: "black-chrome_upgrades",
  ESkB5MZNBQ9Kh5bw: "black-chrome_vehicles",
  gGfQhTIQwjSoLeOX: "black-chrome_vehicles",
  XTHPa35uHkTYBjq4: "black-chrome_vehicles",
  qt96px3IUob27p9f: "black-chrome_vehicles",
  Q8XG4TMqvwqMfaZK: "black-chrome_vehicles",
  q1iVXiJtU7rRtseq: "black-chrome_vehicles",
  eTdomqPYaFg1CAp5: "black-chrome_vehicles",
  wNTiJOENNGnDLTgt: "black-chrome_vehicles",
  "8m4m9SW2tfrhX9cs": "black-chrome_vehicles",
  "3EVQOiwBjZNnKYjR": "black-chrome_vehicles",
  "7CayuDCC2lrf4LkR": "black-chrome_vehicles",
  rUOr6Yn2r6AZ91XW: "black-chrome_vehicles",
  vlIGLZxqhZHEdxqg: "black-chrome_vehicles",
  "1OX1HUFSyeKUbvoo": "black-chrome_vehicles",
  F3jEryfSWKmPUmpB: "black-chrome_vehicles",
  mjoHK8yhLZoNnjlS: "black-chrome_vehicles",
  KQw6UltgErhRC89e: "black-chrome_vehicles",
  eOYoIDcKCerXeoyb: "black-chrome_vehicles",
  "5n9vsR9685ti1ffI": "black-chrome_vehicles",
  mnBXoGrgbAV7arAE: "black-chrome_vehicles",
  Qs40FdFNYmpEf6lM: "black-chrome_vehicles",
  thLFAzw0AHhT0cSI: "black-chrome_vehicles",
  "6zH9r2jEY9ytH4em": "black-chrome_vehicles",
  eIoxfi6GHKCnjAG5: "black-chrome_vehicles",
  "6I91wpBkczPpDkZt": "black-chrome_vehicles",
  iHBp08W8kaiGikhW: "black-chrome_vehicles",
  eK3VQaeSd2DFYJ9z: "black-chrome_vehicles",
  wRaA0B8aAjqntqsX: "black-chrome_vehicles",
  "7QC1BGi63xrC3FpP": "black-chrome_vehicles",
  J1uOVT3BkhSWuat6: "black-chrome_vehicles",
  qWIFkeCnwb0AVuPK: "black-chrome_vehicles",
  kwurvxruvvm0VxRI: "black-chrome_weapons",
  Ifp6KgNYeZ0wfKSN: "black-chrome_weapons",
  C1u6clpJPtn9DAWo: "black-chrome_weapons",
  "7q61PwpWp0KM6vYb": "black-chrome_weapons",
  Zp90Q36fQ769vmhp: "black-chrome_weapons",
  "6uCUKRntpkVSnRkw": "black-chrome_weapons",
  yPKIpu75TmOHSXWi: "black-chrome_weapons",
  zlMwOSfLLbuxnose: "black-chrome_weapons",
  IxXIb9gFdbjUCPZW: "black-chrome_weapons",
  xuxITCWhHzvdr7Yi: "black-chrome_weapons",
  Www5jXWJlfhyuAzn: "black-chrome_weapons",
  RwZUbGdbyp5KTEc5: "black-chrome_weapons",
  eOsTEhtcRVyKxV7u: "black-chrome_weapons",
  GVG933xxERHQztLs: "black-chrome_weapons",
  K97WPZL6SF5DnMoE: "black-chrome_weapons",
  "062x3IuaFgsjMV5X": "black-chrome_weapons",
  WanZL37uS6qD7acP: "black-chrome_weapons",
  "2BgF22RoBRIYCQcz": "black-chrome_weapons",
  "398a6e2GP6Vie9Lr": "black-chrome_weapons",
  N2JO2RGnXWvrGjGf: "black-chrome_weapons",
  uyBRdbvnCDcFdO82: "black-chrome_weapons",
  nsK7GNeDIwpNiGu4: "black-chrome_weapons",
  KDulu2DdWVzPwKuv: "black-chrome_weapons",
  zfpSCTCQTsEBBtVg: "black-chrome_weapons",
  rwfBQoEJu2uLnGeo: "black-chrome_weapons",
  OqCYiOiTR4zpimAq: "black-chrome_weapons",
  mDciV1eKpoew146L: "black-chrome_weapons",
  hRvni7utn2zcjSWH: "black-chrome_weapons",
  MGWv5ebRm7FzFt9C: "black-chrome_weapons",
  "1O4nQzf7gVLVwqnL": "black-chrome_weapons",
  DroG3PMwgQcJ3hmk: "black-chrome_weapons",
  YLYKK3N4631dbRwt: "black-chrome_weapons",
  dnX1vhlKwmacyuNs: "black-chrome_weapons",
  sOsNx7YCfB7Z1c6D: "black-chrome_weapons",
  N3O9kYdqirfIbhNw: "black-chrome_weapons",
  s72mTsiZhAJHvLg5: "black-chrome_weapons",
  tthUaY2iqrpUlO44: "black-chrome_weapons",
  xJbPj5c7LFu8b5eU: "black-chrome_weapons",
  Aq3Fim1KykSIjtXU: "black-chrome_weapons",
  t0cGEnuajobz3wTq: "black-chrome_weapons",
  LrmIgdYrPbDUw2mw: "black-chrome_weapons",
  "3WelrloimwsNI29P": "black-chrome_weapons",
  OHMbhkYy7we5ieIL: "black-chrome_weapons",
  kQ8ZI0Fv1wDnZ5Ru: "black-chrome_weapons",
  GiU3T4aczKpAP91x: "black-chrome_weapons",
  "61MgW9KsLYKJVtbA": "black-chrome_weapons",
  my1ugVO4a5VjJSuH: "black-chrome_weapons",
  "1VndXRKaCuKQp49H": "black-chrome_weapons",
  CW4Vmiv2Rqo4JZxR: "black-chrome_weapons",
  MVZoOzbbPrkBkj53: "black-chrome_weapons",
  "0otxxiItP76VGlGt": "black-chrome_weapons",
  "1ayjbnRGQCmcauzG": "dlc_ammo",
  OCEWvjde4ZKq78ao: "dlc_ammo",
  "2yCAIxsvTactJtVF": "dlc_ammo",
  "57Zf1zet8M2KlXsw": "dlc_ammo",
  TTn8GdqM6rnjHSCX: "dlc_ammo",
  rRM8ArZ4RlX7EnBh: "dlc_ammo",
  EZ2R3oCObc2qMJdw: "dlc_ammo",
  f0W9iRdCapEDdVHC: "dlc_ammo",
  Gxesk4mgq9yMNJKw: "dlc_ammo",
  oZCZLAUVwbWZnHgj: "dlc_ammo",
  frnQaR6QRCqmSUZk: "dlc_ammo",
  UCDzCXYth1eKdmX8: "dlc_ammo",
  DP2OBdCL01QtUk1p: "dlc_ammo",
  ylPhumg2XILRtZYs: "dlc_ammo",
  V1DsAqTT45qL6ZUY: "dlc_ammo",
  uufKUdm7eZ7SFZmB: "dlc_ammo",
  dy2LvajTiRM00UMo: "dlc_ammo",
  "1004Olp4DHhMOc1z": "dlc_ammo",
  EPsdOtdiTfe50lFB: "dlc_armor",
  q7x8ew6xdBFmBeVk: "dlc_armor",
  cnI1LNiN3K45ZBrD: "dlc_armor",
  ZWoM763wXSI3njJA: "dlc_armor",
  CJB0sTptAOnLoEfu: "dlc_clothing",
  K42qIOEAJFerKaAP: "dlc_consumables",
  zo5qPTOJZYOBnTr5: "dlc_consumables",
  lzmfwfxPjDjYE1nM: "dlc_consumables",
  "04uz9ECkrTB6roW7": "dlc_consumables",
  spEyCAKJ2cCYV4cd: "dlc_consumables",
  B6tOeLYhL3EO6MqU: "dlc_consumables",
  CJXhH4vxt7mG8SPs: "dlc_consumables",
  LkvE3QdpqN1qIDYo: "dlc_consumables",
  BpUQ60vOvTEiP9qz: "dlc_consumables",
  K1quBJLZzdvXATKj: "dlc_consumables",
  "1FH096Iy8WWcchZj": "dlc_consumables",
  ZLeBfyzlO2FinwRJ: "dlc_consumables",
  "6aiR4mTBkWI7y7yn": "dlc_consumables",
  KFp1Yg4URKeoSaWm: "dlc_consumables",
  oSDHOFq1HIsvOBzH: "dlc_consumables",
  jJun14AJf7YyViMa: "dlc_consumables",
  PZY9ZgIHheXBoMmo: "dlc_consumables",
  ghhfd1squnNuXpBl: "dlc_consumables",
  X8S3OTwLeagyRy7u: "dlc_consumables",
  rmnEdJwroCb739VA: "dlc_consumables",
  BA0UVQGCyRsLvYuX: "dlc_consumables",
  wAUReVQtYbe3TNSj: "dlc_consumables",
  RZ7P9nSOB21pfiaI: "dlc_consumables",
  Tv6eIBNtpwqRqJSO: "dlc_consumables",
  ka6ccQeTt7ud3pFi: "dlc_consumables",
  PRLDaeBVeMuBBIeO: "dlc_consumables",
  yt1g8o7UtSzkWtwW: "dlc_consumables",
  "3y5SG4laabV5oOJS": "dlc_consumables",
  FHK9go7UwOLqmrcv: "dlc_consumables",
  K5pC3fKvx02txK77: "dlc_consumables",
  "8nOTvNR4qZP54nKy": "dlc_consumables",
  "2ea71NL50IBcCcJZ": "dlc_consumables",
  yg40tc7NTyqXHaF7: "dlc_consumables",
  OXuMYH1jqRNmGurK: "dlc_consumables",
  TVgFdyPTl0aVAQz5: "dlc_cyberware",
  nFysJU3aqxEIYpwb: "dlc_cyberware",
  mqxZ6A9U0LhaDwJm: "dlc_cyberware",
  "9rKtuQcxsOmHjKyT": "dlc_cyberware",
  avqM5i0tzCS4kkF0: "dlc_cyberware",
  OXYFhzH96WZkrAX7: "dlc_cyberware",
  jcaBaa81CJiRktcu: "dlc_cyberware",
  yoTV7C3y1qXrXklA: "dlc_cyberware",
  VFGaOCbuOSyWbkbJ: "dlc_cyberware",
  Pf0nIIWogwohv3gc: "dlc_cyberware",
  I0pjOnvHaJUFVz05: "dlc_cyberware",
  iNxJ842m5FbiSAjs: "dlc_cyberware",
  FcOy1Vf6drgZQC9n: "dlc_cyberware",
  h8mS30jnIMvWNOst: "dlc_cyberware",
  ETXZYwKcuDZ8Iw1B: "dlc_cyberware",
  "8Az7bJTWSZSK577k": "dlc_cyberware",
  U8SdGzK5sIdWHaQ1: "dlc_cyberware",
  ELLIHejsxsklkxkC: "dlc_cyberware",
  ViH7d2nQAg0dLQuD: "dlc_cyberware",
  jSq3PCutxWhieWDS: "dlc_cyberware",
  "37RCGTuozpxgA9EN": "dlc_cyberware",
  dd2lvP5sNl3Qp7Qr: "dlc_cyberware",
  jUgKtC1UW35ywBY6: "dlc_cyberware",
  o8fra501wz1HmA9K: "dlc_cyberware",
  z6SGFU2FVhXqFpvT: "dlc_cyberware",
  Kgs5sQHSRjKHZIMN: "dlc_cyberware",
  u9qz2RDLomNTMl2n: "dlc_cyberware",
  vBtkLoClI8oQWXLx: "dlc_cyberware",
  P19OmJOcdgjhgjLm: "dlc_cyberware",
  AUQradHgpwzsx7rS: "dlc_cyberware",
  jM0d8EgkRSHrIccX: "dlc_cyberware",
  NdcmIwmMz1OHfMu9: "dlc_cyberware",
  "6uuWSi4tV44EJoPi": "dlc_cyberware",
  rUSdivkoD9THJXNy: "dlc_cyberware",
  Iz2e2ZpOnShK6PBJ: "dlc_cyberware",
  ZgzEBlYC72NkbXkv: "dlc_cyberware",
  D7TFt1EHP20nKr8S: "dlc_cyberware",
  hoHJUv9O3dPEZk2m: "dlc_cyberware",
  YaBhjpiiLwydzqGt: "dlc_cyberware",
  mTL4ZsBLRd6dO7Hv: "dlc_cyberware",
  us01uD7Iko8X91G8: "dlc_gear",
  s6f9GxYUg6IUgehg: "dlc_gear",
  YdXY7sRFUX8KBKzq: "dlc_gear",
  k4nLy56kpKLTctaO: "dlc_gear",
  PuGtYLlDTvSiBEKz: "dlc_gear",
  fVIM3FiEpnx5ha1f: "dlc_gear",
  QbTwGu5hr1Ty9tlp: "dlc_gear",
  WyKK67Ii0oOYOS3d: "dlc_gear",
  "2XWVECWhfnVrwtQv": "dlc_gear",
  G52izEikFPz8IftP: "dlc_gear",
  "6SLvZUo4JER4sFWn": "dlc_gear",
  i3ctRyHXpcva3ccw: "dlc_gear",
  rkLqCqLvZ26DyYDz: "dlc_gear",
  omSuV3gSqbIedBhs: "dlc_gear",
  PJZmDEjwaM5RWguB: "dlc_gear",
  wNBD9RPisrschAMX: "dlc_gear",
  hBZ1Wwu7nw2foURO: "dlc_gear",
  bDif9oZ2gb46jAx3: "dlc_gear",
  bN0IlqYtNMj0uF0B: "dlc_gear",
  cU6gNT7lw2gaTBAC: "dlc_gear",
  JMYvZfk6ZBgt6tK0: "dlc_gear",
  TitGVNMfgm6fsYsT: "dlc_gear",
  EDyAgDm44dFXiBKE: "dlc_gear",
  rl7LT2WYItMqMoLm: "dlc_gear",
  jlic1cP0wr7DOwad: "dlc_gear",
  mmckNZZHbEtSoyA1: "dlc_gear",
  IsoP0QOpFiQtwIV3: "dlc_gear",
  "1Uv3Sr204rM82du8": "dlc_gear",
  QmbulrL80VvoK2Wk: "dlc_gear",
  LUc8nYLERP5vhxyT: "dlc_gear",
  R3HxQCBBkQ7iHOzY: "dlc_gear",
  NTD1wXId7S541HTe: "dlc_gear",
  yI9sUHnAIXGYncg9: "dlc_gear",
  XbKkA6CrI42pvdcz: "dlc_gear",
  AFb5xt7apNdhlLWp: "dlc_gear",
  PfpMt2ZXlntX0VP6: "dlc_gear",
  p8CaaXc2lR3nykju: "dlc_gear",
  QLmJalY4Tf3ZqXV5: "dlc_gear",
  "9SVhwuFxogbbXgsG": "dlc_gear",
  ViR7w7mbissI2QPl: "dlc_gear",
  "5I7hkCleUNdrgRoI": "dlc_gear",
  bRHD97cVlO7rcie7: "dlc_gear",
  DH4W3aiKxj7aQA9D: "dlc_gear",
  myBn6xsxyEKDcoYc: "dlc_gear",
  YM2dXOMEhmYn3LKy: "dlc_gear",
  ELiFtgO54UTQ10gU: "dlc_gear",
  "2PlaTDusjlJvl1aD": "dlc_gear",
  KNY6BomYkUOkpctH: "dlc_gear",
  qLpYhxmPD1u2lMG8: "dlc_gear",
  oNzue3FRO2CpslGJ: "dlc_gear",
  "8M7yCgP1P29TVFcK": "dlc_gear",
  B1qjlWJWYKwXwdOD: "dlc_rolltables",
  uq1cseo3a1hAx7Pg: "dlc_rolltables",
  xWZowpQzG7fpmoP7: "dlc_rolltables",
  zRHyYnlEqNlTA4l5: "dlc_rolltables",
  VszxZ4TJjQ8FGuoc: "dlc_rolltables",
  "4S3emhUCIIDNoTAg": "dlc_rolltables",
  T6pocp9VStxtFPzP: "dlc_rolltables",
  bOtq937SNIahmbeK: "dlc_rolltables",
  EVPuZ21eNOpEycGQ: "dlc_rolltables",
  McQc33tLYAp7djIV: "dlc_rolltables",
  WmWdGRlhzhA2ZcmV: "dlc_rolltables",
  mZYAzfiDVvrInz2h: "dlc_upgrades",
  P3PN6f1l6o4s3b0J: "dlc_upgrades",
  Pj3nZU2coYUGIjR3: "dlc_upgrades",
  exOe2dlYZYps3g21: "dlc_upgrades",
  ajAbsPsSmQxsBbKn: "dlc_upgrades",
  u3PSLc6L0OGt8wcQ: "dlc_upgrades",
  RrWmVcAavS9KFH1T: "dlc_upgrades",
  "2BWPnJqXqz2kCjwy": "dlc_upgrades",
  h8e6qjzoo0JLaNOe: "dlc_upgrades",
  X3QvlINFBZtTGISU: "dlc_upgrades",
  HrXBoDWGob5w8Wz4: "dlc_upgrades",
  BaeRhbjlaBcA4Bjz: "dlc_upgrades",
  BMtpB0IpvAp6xon8: "dlc_upgrades",
  P9jImk9MAd7h32Pn: "dlc_upgrades",
  yX1le8igdQn64AUG: "dlc_upgrades",
  gIAmp0pgALSAz3c2: "dlc_upgrades",
  PtsNxe8ZldUu1hRm: "dlc_upgrades",
  tny5QJTwitpn37l2: "dlc_upgrades",
  zZYQHXJ96WQS8FAu: "dlc_upgrades",
  KeZK6VNDIqcmUX0p: "dlc_upgrades",
  TCqtHNto4TZa5EPF: "dlc_upgrades",
  "4lQ54pxcVlCLKaie": "dlc_upgrades",
  "81qxDB83rnxGNjdK": "dlc_upgrades",
  "0SNhtwJWwKfeSfRu": "dlc_upgrades",
  QW3t9BOscyXw681t: "dlc_upgrades",
  djaT25YA4Jug9WfX: "dlc_upgrades",
  YZXwCLLK4t6UeyfW: "dlc_upgrades",
  BHsWIPyufXZR7ncC: "dlc_upgrades",
  mfPOgdF9AABuAwWa: "dlc_upgrades",
  XIDIqcWCFJtzYeRw: "dlc_vehicles",
  cpFm1nJT5GQoERj4: "dlc_vehicles",
  Z8YmmVuwRRD2Xa4H: "dlc_weapons",
  xuffoWmepDctyMhs: "dlc_weapons",
  yMgSyUvci14qO9WE: "dlc_weapons",
  dnfLVJnDKlEdLkpy: "dlc_weapons",
  ZvjhbBWnWQQduup0: "dlc_weapons",
  "2dYYGb00Ve96CBpS": "dlc_weapons",
  cUgtpdroFgBBJGam: "dlc_weapons",
  kKWg7W7ySbQGl5eT: "dlc_weapons",
  aqyQqrLUiN9iTv3v: "dlc_weapons",
  moqJ5beR4WqWCpZM: "dlc_weapons",
  YHhTX03AJFe0cS5N: "dlc_weapons",
  okVi2Gn9qk8KH7sD: "dlc_weapons",
  qqNh3sElWPyVT4Qq: "dlc_weapons",
  maC7pXPwRqULiTPF: "dlc_weapons",
  goHANswbJoTXBlpG: "dlc_weapons",
  EpnkbYJED7yNCwcy: "dlc_weapons",
  Mnf5BkWEt22EvAfK: "dlc_weapons",
  qL9B85FSo6cYhTBL: "dlc_weapons",
  mHKNifoCC2mNhT45: "dlc_weapons",
  tk2g10vp4EdMXLPK: "dlc_weapons",
  LnOj3QW7fU5auvUg: "dlc_weapons",
  poMp4coxB8SORzvi: "dlc_weapons",
  iKzJWiFQqBcDQ7Gm: "dlc_weapons",
  "5boGB9jFKUJ9cSMR": "dlc_weapons",
  pNkckh9tZBwSBxA2: "dlc_weapons",
  puBNVffqHLoGXXnd: "dlc_weapons",
  eZM7VjirAA4bTsni: "dlc_weapons",
  "8X8llGr7eUD7KMmP": "dlc_weapons",
  "8wVlu4VqXbhL0XKA": "dlc_weapons",
  bU1k6gqkEs9Dn6T8: "dlc_weapons",
  qQO7cw9BbGNNken1: "elflines_ammo",
  gbp8WiY21LEcNnif: "elflines_ammo",
  IZwINpYpfLLAq5zb: "elflines_ammo",
  N0XtKbgIohJmwa5R: "elflines_armor",
  kZy1Hr5L1oUdY3k8: "elflines_armor",
  N2bk4F8YVgALbUH7: "elflines_armor",
  "6w3JLFVB9VIOmCmI": "elflines_armor",
  aQsTfMuwscY8JqcG: "elflines_armor",
  djhqRvyLhzXexgoS: "elflines_armor",
  PcfZoO9meC9iAMkY: "elflines_armor",
  W0WjuvkDFdAsjFUq: "elflines_armor",
  FN8z10b6DqOpT40g: "elflines_armor",
  yobTPhOaGRpfkjz8: "elflines_gear",
  E0eXW07wzBlBYytp: "elflines_gear",
  QNPY6vNAFw8ugKH8: "elflines_gear",
  zDjspn0R9fgRILpv: "elflines_gear",
  gaGUmTGViuxZ4mqR: "elflines_gear",
  YI3MVPWwjfWK4Woa: "elflines_macros",
  n8wOKWrJUC0ZS5jg: "elflines_weapons",
  Cq0h1I75g6Q4NM1h: "elflines_weapons",
  dB1xFjNIIdZ536Km: "elflines_weapons",
  syV8GagEmOsAOMkj: "elflines_weapons",
  "9ZQqizz1ulgcqnec": "elflines_weapons",
  nv81kP4MF4lTR7Iw: "elflines_weapons",
  qYcmlmhYCE63uZlr: "elflines_weapons",
  hX7MARVQ4DYhZhKN: "elflines_weapons",
};

export default class SplitPacks extends BaseMigrationScript {
  static version = 39;

  static name = "Migrate Image paths and references following pack split";

  static documentFilters = {
    Item: { types: [], mixins: [] },
    Actor: { types: ["character", "mook", "blackIce", "demon"], mixins: [] },
  };

  /*
   * Helper functions
   */

  _processString(str) {
    if (!str) {
      return str;
    }
    const compRegex =
      /@UUID\[Compendium\.cyberpunk-red-core\.([a-zA-Z0-9_-]*)\.([a-zA-Z]*)\.([a-zA-Z0-9]*)\]/g;
    return str.replace(compRegex, (match, _, type, itemId) => {
      const newPack = PACK_MAP[itemId];
      if (newPack) {
        return `@UUID[Compendium.cyberpunk-red-dlc.${newPack}.${type}.${itemId}]`;
      }
      return match;
    });
  }

  async _updatePageContent(doc) {
    for (const page of doc.pages) {
      const newText = this._processString(page.text.content);
      if (newText !== page.text.content) {
        await page.update({ "text.content": newText });
      }
    }
  }

  async _updateTableResult(doc) {
    const { results } = doc;
    for (const result of results) {
      const id = result.documentId;
      const { img } = result;
      const newComp = PACK_MAP[id];
      const update = {};

      if (newComp) {
        update.documentCollection = `cyberpunk-red-dlc.${newComp}`;
      }

      if (IMG_MAP[img]) {
        update.img = IMG_MAP[img];
      }

      if (Object.keys(update).length) {
        await result.update(update);
      }
    }
  }

  /*
   * Migrations
   */

  async updateItem(doc) {
    const { img } = doc;
    const desc = doc.system.description.value;
    if (IMG_MAP[img]) {
      doc.img = IMG_MAP[img];
    }
    doc.system.description.value = this._processString(desc);
  }

  async updateActor(doc) {
    if (["character", "mook"].includes(doc.type)) {
      const { notes } = doc.system.information;
      const { lifepath } = doc.system;
      const { lifestyle } = doc.system;

      doc.system.information.notes = this._processString(notes);

      if ("lifepath" in doc.system) {
        for (const lp of Object.keys(lifepath)) {
          lifepath[lp] = this._processString(lifepath[lp]);
        }
      }

      if ("lifestyle" in doc.system) {
        for (const ls of Object.keys(lifestyle)) {
          lifestyle[ls].description = this._processString(
            lifestyle[ls].description,
          );
        }
      }
    }

    if (["demon", "blackIce"].includes(doc.type)) {
      const { notes } = doc.system;

      doc.system.notes = this._processString(notes);
    }
  }

  async migrateMisc() {
    /*
     * Journals
     */
    const journalsWorld = game.journal;
    const journalsWorldComp = CPRSystemUtils.GetCompendiaByType(
      "world",
      "JournalEntry",
    );
    const journalsModuleComp = CPRSystemUtils.GetCompendiaByType(
      "module",
      "JournalEntry",
    );

    const journalComps = [...journalsWorldComp, ...journalsModuleComp];

    for await (const journal of journalsWorld) {
      await this._updatePageContent(journal);
    }

    for await (const comp of journalComps) {
      const pack = await game.packs.get(comp.metadata.id);
      const docs = await pack.getDocuments();
      const wasLocked = await pack.locked;

      if (wasLocked) {
        await pack.configure({ locked: false });
      }

      for (const doc of docs) {
        await this._updatePageContent(doc);
      }

      if (wasLocked) {
        await pack.configure({ locked: true });
      }
    }

    /*
     * RollTables
     */
    const tablesWorld = game.tables;
    const tablesWorldComp = CPRSystemUtils.GetCompendiaByType(
      "world",
      "RollTable",
    );
    const tablesModuleComp = CPRSystemUtils.GetCompendiaByType(
      "module",
      "RollTable",
    );

    const tablesComps = [...tablesWorldComp, ...tablesModuleComp];

    for await (const table of tablesWorld) {
      await this._updateTableResult(table);
    }

    for await (const table of tablesComps) {
      const pack = await game.packs.get(table.metadata.id);
      const docs = await pack.getDocuments();
      const wasLocked = await pack.locked;

      if (wasLocked) {
        await pack.configure({ locked: false });
      }

      for (const doc of docs) {
        await this._updateTableResult(doc);
      }

      if (wasLocked) {
        await pack.configure({ locked: true });
      }
    }

    /*
     * Scenes
     */
    const scenesWorld = game.scenes;
    const scenesWorldComp = CPRSystemUtils.GetCompendiaByType("world", "Scene");
    const scenesModuleComp = CPRSystemUtils.GetCompendiaByType(
      "module",
      "Scene",
    );

    const scenesComps = [...scenesWorldComp, ...scenesModuleComp];

    for await (const scene of scenesWorld) {
      const { tiles } = scene;

      for await (const tile of tiles) {
        const img = tile.texture.src;
        if (IMG_MAP[img]) {
          await tile.update({ "texture.src": IMG_MAP[img] });
        }
      }
    }

    for await (const s of scenesComps) {
      const pack = await game.packs.get(s.metadata.id);
      const docs = await pack.getDocuments();
      const wasLocked = await pack.locked;

      if (wasLocked) {
        await pack.configure({ locked: false });
      }

      for (const doc of docs) {
        for (const tile of doc.tiles) {
          const img = tile.texture.src;
          if (IMG_MAP[img]) {
            await tile.update({ "texture.src": IMG_MAP[img] });
          }
        }
      }

      if (wasLocked) {
        await pack.configure({ locked: true });
      }
    }
  }
}
