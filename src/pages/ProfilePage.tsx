import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { LogOut } from "../components/Icons";
import { MyPayments } from "../components/MyPayments";
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
    [photo, setPhoto] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [cropSource, setCropSource] = useState(""),
    [removePhoto, setRemovePhoto] = useState(false);
  if (!profile) return <Spinner />;
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
              if(file){setCropSource(URL.createObjectURL(file));setRemovePhoto(false)}
            }}
          />
          </label>
          {image && (
            <div className="profile-photo-actions"><button type="button" onClick={()=>setCropSource(image)}>Ajustar foto</button><button type="button" className="profile-photo-remove" onClick={() => {setPhoto(null);setPreview("");setRemovePhoto(true)}}>Remover foto</button></div>
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
      <MyPayments />
      <button
        className="secondary full"
        onClick={() => supabase.auth.signOut()}
      >
        <LogOut /> SAIR DA CONTA
      </button>
      <Toast message={toast} />
      {cropSource&&<AvatarCropper src={cropSource} onCancel={()=>{if(cropSource.startsWith('blob:'))URL.revokeObjectURL(cropSource);setCropSource('')}} onConfirm={file=>{if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);if(cropSource.startsWith('blob:'))URL.revokeObjectURL(cropSource);setPhoto(file);setPreview(URL.createObjectURL(file));setCropSource('');setRemovePhoto(false)}}/>}
    </section>
  );
}
