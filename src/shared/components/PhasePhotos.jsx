import { useEffect, useState } from 'react';
import { Camera, X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const BUCKET = 'phase-photos';

// Small inline uploader attached to a PhaseBreakdown check-off item.
// Shows:
//   [📷] [thumb] [thumb] [+N]
// - camera icon → opens native file picker (uses rear camera on mobile)
// - each tiny thumbnail → opens full-screen viewer at that index
// - if more than 3 uploaded, shows "+N" chip that opens the viewer at 3
//
// Errors are surfaced inline (red ! chip with tooltip) so broken uploads
// don't disappear silently.
export default function PhasePhotos({ jobId, phaseId, itemId, user }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);   // index or null
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId || !phaseId || !itemId) return;
    load();
    // eslint-disable-next-line
  }, [jobId, phaseId, itemId]);

  async function load() {
    try {
      const { data, error: e } = await supabase
        .from('phase_photos')
        .select('*')
        .eq('job_id', jobId)
        .eq('phase_id', phaseId)
        .eq('item_id', itemId)
        .order('taken_at', { ascending: false });
      if (e) throw e;
      setPhotos(data || []);
    } catch (e) {
      // Missing table → surface a short message so the dev knows to run
      // the migration. Still renders the camera icon so tap-to-upload
      // will give the same clear error.
      setError(e?.message || 'Could not load photos');
    }
  }

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // Safe filename — strip path separators and odd chars.
      const safeName = String(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${jobId}/${phaseId}/${itemId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('Uploaded but no public URL returned');

      const { data, error: insErr } = await supabase.from('phase_photos').insert([{
        job_id: jobId,
        phase_id: phaseId,
        item_id: itemId,
        type: 'progress',
        photo_url: url,
        taken_by: user?.name || null,
      }]).select().single();
      if (insErr) throw insErr;

      setPhotos((prev) => [data, ...prev]);
    } catch (e) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // Show up to 3 thumbnails; anything else collapses into "+N".
  const shownThumbs = photos.slice(0, 3);
  const extra = Math.max(0, photos.length - shownThumbs.length);

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {/* Camera button (opens file picker / mobile camera) */}
        <label
          className={`cursor-pointer inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
            uploading ? 'bg-omega-pale text-omega-orange' : 'text-omega-stone hover:bg-omega-pale hover:text-omega-orange'
          }`}
          title={uploading ? 'Uploading…' : 'Add photo'}
        >
          <Camera className={`w-3.5 h-3.5 ${uploading ? 'animate-pulse' : ''}`} />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = ''; // allow re-picking the same file
              upload(f);
            }}
            disabled={uploading}
          />
        </label>

        {/* Thumbnails */}
        {shownThumbs.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setViewer(i)}
            className="w-6 h-6 rounded-md overflow-hidden border border-gray-200 hover:border-omega-orange transition-colors"
            title="View photo"
          >
            <img
              src={p.photo_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}

        {extra > 0 && (
          <button
            onClick={() => setViewer(shownThumbs.length)}
            className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-omega-pale text-omega-orange text-[10px] font-bold hover:bg-omega-orange hover:text-white transition-colors"
            title={`View ${extra} more`}
          >
            +{extra}
          </button>
        )}

        {error && (
          <span
            className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-red-100 text-red-600"
            title={error}
          >
            <AlertCircle className="w-3 h-3" />
          </span>
        )}
      </div>

      {/* Full-screen viewer */}
      {viewer !== null && photos[viewer] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setViewer(null)}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={photos[viewer].photo_url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setViewer((v) => (v - 1 + photos.length) % photos.length); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setViewer((v) => (v + 1) % photos.length); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-xs font-semibold">
                {viewer + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
