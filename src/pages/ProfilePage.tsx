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
import "./profile-page.css";

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
    [preview, setPreview] = useState(""),
    [removePhoto, setRemovePhoto] = useState(false);
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
      const foto_url = photo
        ? await uploadAvatar(photo)
        : removePhoto
          ? null
          : profile!.foto_url;
      await updateOwnProfile({
        nome: String(f.get("nome")),
        apelido: String(f.get("apelido") || "") || null,
        telefone: String(f.get("telefone") || "") || null,
        foto_url,
      });
      await refreshProfile();
      setPhoto(null);
      setPreview("");
      setRemovePhoto(false);
      setToast("Cadastro atualizado.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  const image = removePhoto ? "" : preview || profile.foto_url,
    displayName = profile.apelido || profile.nome,
    secondaryName =
      profile.apelido?.trim().toLocaleLowerCase() ===
      profile.nome.trim().toLocaleLowerCase()
        ? ""
        : profile.nome;
  return (
    <section>
      <div className="profile-head">
        <div className="profile-photo-editor">
          <label className="profile-photo-picker">
            <span className="profile-avatar">
              {image ? (
                <img src={image} alt="Foto do perfil" />
              ) : (
                (profile.apelido || profile.nome)[0]
              )}
              <span className="profile-photo-overlay">
                {image ? "ALTERAR" : "ADICIONAR"}
              </span>
            </span>
            <small>
              Toque na foto para {image ? "substituir" : "adicionar uma imagem"}
            </small>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={image ? "Alterar foto do perfil" : "Adicionar foto do perfil"}
            onClick={(e) => (e.currentTarget.value = "")}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              if (file?.size && file.size > 5 * 1024 * 1024) {
                setToast("A foto deve ter até 5 MB.");
                e.target.value = "";
                return;
              }
              setPhoto(file);
              setPreview(file ? URL.createObjectURL(file) : "");
              setRemovePhoto(false);
            }}
          />
          </label>
          {image && (
            <button
              type="button"
              className="profile-photo-remove"
              onClick={() => {
                setPhoto(null);
                setPreview("");
                setRemovePhoto(true);
              }}
            >
              Remover foto
            </button>
          )}
          {(photo || removePhoto) && (
            <small className="profile-photo-pending">
              {removePhoto ? "A foto será removida" : "Nova foto selecionada"}. Salve o cadastro para confirmar.
            </small>
          )}
        </div>
        <div className="profile-identity">
          <h1>{displayName}</h1>
          {secondaryName && <p>{secondaryName}</p>}
          <Badge>
            {profile.tipo_jogador.toUpperCase()} •{" "}
            {profile.posicao_lista.toUpperCase()}
          </Badge>
        </div>
      </div>
      <div className="stats profile-stats">
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
          <strong>{performance?.votos_destaque ?? 0}</strong>
          <span>Destaque</span>
        </div>
      </div>
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
        <button className="wide">SALVAR CADASTRO</button>
      </form>
      <MyPayments />
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
