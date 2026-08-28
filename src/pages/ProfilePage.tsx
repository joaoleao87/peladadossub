import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LogOut } from "../components/Icons";
import { MyPayments } from "../components/MyPayments";
import { NotificationSettings } from "../components/NotificationSettings";
import { AvatarCropper } from "../components/AvatarCropper";
import { Badge, Spinner, Toast } from "../components/Ui";
import {
  updateOwnProfile,
  uploadAvatar,
} from "../lib/api";
import { supabase } from "../lib/supabase";
import "./profile-page.css";

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth(),
    [toast, setToast] = useState(""),
    [cropSource, setCropSource] = useState(""),
    [photoBusy, setPhotoBusy] = useState(false);
  if (!profile) return <Spinner />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await updateOwnProfile({
        nome: String(f.get("nome")),
        apelido: String(f.get("apelido") || "") || null,
        telefone: String(f.get("telefone") || "") || null,
      });
      await refreshProfile();
      setToast("Cadastro atualizado.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao atualizar.");
    } finally {
      setTimeout(() => setToast(""), 3500);
    }
  }
  async function removeAvatar() {
    setPhotoBusy(true);
    try {
      await updateOwnProfile({ foto_url: null });
      await refreshProfile();
      setToast("Foto removida e cadastro atualizado.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Falha ao remover a foto.");
    } finally {
      setPhotoBusy(false);
      setTimeout(() => setToast(""), 3500);
    }
  }
  const image = profile.foto_url,
    displayName = profile.apelido || profile.nome,
    secondaryName = profile.nome;
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
              if(file)setCropSource(URL.createObjectURL(file));
            }}
          />
          </label>
          {image && (
            <div className="profile-photo-actions"><button type="button" disabled={photoBusy} onClick={()=>setCropSource(image)}>Ajustar foto</button><button type="button" disabled={photoBusy} className="profile-photo-remove" onClick={() => void removeAvatar()}>{photoBusy ? "Removendo…" : "Remover foto"}</button></div>
          )}
        </div>
        <div className="profile-identity">
          <h1>{displayName}</h1>
          {secondaryName && <p>{secondaryName}</p>}
          <Badge>
            {profile.tipo_jogador === "mensalista" ? "MENSALISTA" : "DIARISTA"} •{" "}
            {profile.posicao_lista.toUpperCase()}
          </Badge>
        </div>
      </div>
      <form className="panel profile-settings" onSubmit={submit}>
        <h2>Meu cadastro</h2>
        <label><span>Nome</span>
          <input
            name="nome"
            defaultValue={profile.nome}
            minLength={2}
            required
          />
        </label>
        <label><span>Apelido</span>
          <input name="apelido" defaultValue={profile.apelido ?? ""} />
        </label>
        <label><span>Telefone</span>
          <input name="telefone" defaultValue={profile.telefone ?? ""} />
        </label>
        <div className="profile-readonly"><span>Categoria</span><b>{profile.tipo_jogador === "mensalista" ? "Mensalista" : "Diarista"}</b></div>
        <div className="profile-readonly"><span>Posição</span><b>{profile.posicao_lista === "goleiro" ? "Goleiro" : "Linha"}</b></div>
        <small>A categoria e a posição são definidas pela administração.</small>
        <button>SALVAR ALTERAÇÕES</button>
      </form>
      <section className="panel profile-install">
        <span aria-hidden="true">📲</span>
        <div><h2>Instalar aplicativo</h2><p>Adicione o Pelada dos Sub à tela inicial do celular para acessar mais rápido.</p></div>
        <Link to="/instalar">VER INSTRUÇÕES DE INSTALAÇÃO</Link>
      </section>
      <NotificationSettings />
      <MyPayments />
      <button
        className="secondary full"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut /> SAIR DA CONTA
      </button>
      <Toast message={toast} />
      {cropSource&&<AvatarCropper src={cropSource} onCancel={()=>{if(cropSource.startsWith('blob:'))URL.revokeObjectURL(cropSource);setCropSource('')}} onConfirm={async file=>{const foto_url=await uploadAvatar(file);await updateOwnProfile({foto_url});await refreshProfile();if(cropSource.startsWith('blob:'))URL.revokeObjectURL(cropSource);setCropSource('');setToast("Foto atualizada no cadastro.");setTimeout(()=>setToast(""),3500)}}/>}
    </section>
  );
}
