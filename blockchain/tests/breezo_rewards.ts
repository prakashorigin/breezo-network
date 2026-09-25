import * as anchor from "@coral-xyz/anchor";
import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BreezoRewards } from "../target/types/breezo_rewards";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const program = anchor.workspace.BreezoRewards as anchor.Program<BreezoRewards>;
const owner = (provider.wallet as anchor.Wallet).payer;
const sensorId = `TEST-${Date.now()}`.slice(0, 32);
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
const [sensor] = PublicKey.findProgramAddressSync([Buffer.from("sensor"), owner.publicKey.toBuffer(), Buffer.from(sensorId)], program.programId);
const [access] = PublicKey.findProgramAddressSync([Buffer.from("access"), sensor.toBuffer(), owner.publicKey.toBuffer()], program.programId);

test("initializes the program authority and registers an owner PDA", async () => {
  await program.methods.initialize().accounts({ config, authority: owner.publicKey, systemProgram: SystemProgram.programId }).rpc();
  await program.methods.registerSensor(sensorId).accounts({ sensor, owner: owner.publicKey, systemProgram: SystemProgram.programId }).rpc();
  const state = await program.account.sensorAccount.fetch(sensor);
  assert.equal(state.sensorId, sensorId);
  assert.equal(state.owner.toBase58(), owner.publicKey.toBase58());
  assert.equal(state.isVerified, false);
  await program.methods.verifySensor().accounts({ config, authority: owner.publicKey, owner: owner.publicKey, sensor }).rpc();
  await program.methods.recordReward(new anchor.BN(50)).accounts({ config, authority: owner.publicKey, owner: owner.publicKey, sensor }).rpc();
  assert.equal((await program.account.sensorAccount.fetch(sensor)).pendingRewards.toNumber(), 50);
  await program.methods.grantSensorAccess().accounts({ sensor, owner: owner.publicKey, operator: owner.publicKey, access, systemProgram: SystemProgram.programId }).rpc();
  await program.methods.updateSensorStatus(false).accounts({ sensor, operator: owner.publicKey, access }).rpc();
  assert.equal((await program.account.sensorAccount.fetch(sensor)).isActive, false);
  await program.methods.revokeSensorAccess().accounts({ sensor, owner: owner.publicKey, operator: owner.publicKey, access }).rpc();
});
