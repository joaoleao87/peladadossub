import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { LogOut } from "../components/Icons";
import { MyPayments } from "../components/MyPayments";
import { Badge, ErrorState, Spinner, Toast } from "../components/Ui";
import { useLoad } from "../hooks/useLoad";
import {
  profileStats,
  rankingStats,
  updateOwnProfile,
  uploadAvatar,
} from "../lib/api";
import { supabase } from "../lib/supabase";

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth(),
    state = useLoad(
      async () => ({
        stats: await profileStats(profile!.id),
        ranking: await rankingStats(),
      }),
      [profile?.id],
    ),
    [toast, setToast] = useState(""),
    [photo, setPhoto] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  if (!profile || state.loading) return <Spinner />;
  if (state.error)
    return <ErrorState message={state.error} retry={state.reload} />;
  const stats = state.data!.stats,
    performance = state.data!.ranking.find(
      (row) => row.user_id === profile.id,
    );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const foto_url = photo ? await uploadAvatar(photo) : profile!.foto_url;
      await updateOwnProfile({
        nome: String(f.get("nome")),
        apelido: String(f.get("apelido") || "") || null,
        telefone: String(f.get("telefone") || "") || null,
        foto_url,
      });
      await refreshProfile();
      setPhoto(null);
      setPreview("");
      setToast("Cadastro atualizado.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  const image = preview || profile.foto_url;
  return (
    <section>
      <div className="profile-head">
        <div className="profile-avatar">
          {image ? (
            <img src={image} alt="" />
          ) : (
            (profile.apelido || profile.nome)[0]
          )}
        </div>
        <h1>{profile.apelido || profile.nome}</h1>
        <p>{profile.nome}</p>
        <Badge>
          {profile.tipo_jogador.toUpperCase()} •{" "}
          {profile.posicao_lista.toUpperCase()}
        </Badge>
      </div>
      <div className="stats">
        <div>
          <strong>{stats.participacoes}</strong>
          <span>Partidas</span>
        </div>
        <div>
          <strong>{stats.presencas}</strong>
          <span>Presenças</span>
        </div>
        <div>
          <strong>{stats.faltas}</strong>
          <span>Faltas</span>
        </div>
        <div>
          <strong>{performance?.gols ?? 0}</strong>
          <span>Gols</span>
        </div>
        <div>
          <strong>
            {performance?.media_nota?.toLocaleString("pt-BR") ?? "—"}
          </strong>
          <span>Nota média</span>
        </div>
        <div>
          <strong>{performance?.votos_destaque ?? 0}</strong>
          <span>Destaques</span>
        </div>
      </div>
      <MyPayments />
      <form className="panel form-grid" onSubmit={submit}>
        <h2>Meu cadastro</h2>
        <label>
          Nome
          <input
            name="nome"
            defaultValue={profile.nome}
            minLength={2}
            required
          />
        </label>
        <label>
          Apelido
          <input name="apelido" defaultValue={profile.apelido ?? ""} />
        </label>
        <label>
          Telefone
          <input name="telefone" defaultValue={profile.telefone ?? ""} />
        </label>
        <label className="wide">
          Foto do perfil
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              if (file?.size && file.size > 5 * 1024 * 1024) {
                setToast("A foto deve ter até 5 MB.");
                e.target.value = "";
                return;
              }
              setPhoto(file);
              setPreview(file ? URL.createObjectURL(file) : "");
            }}
          />
          <small>JPG, PNG ou WEBP • até 5 MB</small>
        </label>
        <button className="wide">SALVAR CADASTRO</button>
      </form>
      <button
        className="secondary full"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut /> SAIR DA CONTA
      </button>
      <Toast message={toast} />
    </section>
  );
}
