package services

import (
	"os"
	"path/filepath"
	"testing"
)

type fakeFileDialogs struct {
	openPath string
	savePath string
}

func (f fakeFileDialogs) OpenBase64TextFile() (string, error)   { return f.openPath, nil }
func (f fakeFileDialogs) SaveDecodedPDF(string) (string, error) { return f.savePath, nil }

func TestFileServiceTreatsDialogCancellationAsSuccess(t *testing.T) {
	service := NewFileService(fakeFileDialogs{})
	opened, err := service.OpenBase64TextFile()
	if err != nil || !opened.Cancelled {
		t.Fatalf("open result = %#v, err = %v", opened, err)
	}
	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil || !saved.Cancelled {
		t.Fatalf("save result = %#v, err = %v", saved, err)
	}
}

func TestFileServiceReadsTextAndWritesPDF(t *testing.T) {
	dir := t.TempDir()
	textPath := filepath.Join(dir, "payload.txt")
	if err := os.WriteFile(textPath, []byte("JVBERi0="), 0o600); err != nil {
		t.Fatal(err)
	}
	pdfPath := filepath.Join(dir, "decoded.pdf")
	service := NewFileService(fakeFileDialogs{openPath: textPath, savePath: pdfPath})

	opened, err := service.OpenBase64TextFile()
	if err != nil {
		t.Fatal(err)
	}
	if opened.Cancelled || opened.Name != "payload.txt" || opened.Text != "JVBERi0=" {
		t.Fatalf("open result = %#v", opened)
	}

	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	if saved.Cancelled || saved.Path != pdfPath {
		t.Fatalf("save result = %#v", saved)
	}
	bytes, err := os.ReadFile(pdfPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(bytes) != "%PDF-test" {
		t.Fatalf("saved bytes = %q", bytes)
	}
}

func TestFileServiceRejectsNonPDFBytes(t *testing.T) {
	service := NewFileService(fakeFileDialogs{savePath: filepath.Join(t.TempDir(), "decoded.pdf")})
	if _, err := service.SaveDecodedPDF("decoded.pdf", []byte("not a pdf")); err == nil {
		t.Fatal("non-PDF bytes unexpectedly saved")
	}
}

func TestFileServiceAddsPDFExtensionToSelectedDestination(t *testing.T) {
	dir := t.TempDir()
	service := NewFileService(fakeFileDialogs{savePath: filepath.Join(dir, "decoded")})

	saved, err := service.SaveDecodedPDF("decoded.pdf", []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(dir, "decoded.pdf")
	if saved.Path != want {
		t.Fatalf("saved path = %q, want %q", saved.Path, want)
	}
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("stat saved PDF: %v", err)
	}
}
